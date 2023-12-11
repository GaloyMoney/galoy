#!/bin/bash

set -eu

export digest=$(cat ./edge-image/digest)
export ref=$(cat ./repo/.git/short_ref)

pushd charts-repo

git checkout "${BRANCH}"

old_digest=$(yq e "${YAML_PATH}" "./charts/${CHART}/values.yaml")

github_url=$(grep "digest: \"${old_digest}\"" "./charts/${CHART}/values.yaml" \
  | sed -n 's/.*repository=\([^;]*\);.*/\1/p' | tr -d ' \n')
old_ref=$(grep "digest: \"${old_digest}\"" "./charts/${CHART}/values.yaml" \
  | sed -n 's/.*commit_ref=\([^;]*\);.*/\1/p' | tr -d ' \n')

pushd ../repo

app_src_files=$(buck2 cquery 'kind("filegroup", deps("'"//apps/${APP}:"'", 0))' --output-attribute src 2>/dev/null | jq -r '[.[]["srcs"][] | sub("root//"; "")]' | jq -r '.[]')

relevant_commits=()

for commit in $(git log --format="%H" ${old_ref}..${ref}); do
  changed_files=$(git diff-tree --no-commit-id --name-only -r $commit)

  for file in ${changed_files[@]}; do
    if [[ " ${app_src_files[*]} " == *"$file"* ]]; then
      relevant_commits+=($commit)
      break
    fi
  done
done

cat <<EOF >> ../body.md
# Bump ${APP} image

Code diff contained in this image:

${github_url}/compare/${old_ref}...${ref}

Relevant commits:
EOF

for commit in ${relevant_commits[@]}; do
  cat <<EOF >> ../body.md
- ${github_url}/commit/${commit}

EOF
done

cat <<EOF >> ../body.md
The ${APP} image will be bumped to digest:
\`\`\`
${digest}
\`\`\`
EOF

pushd ../repo
  git cliff --config ../pipeline-tasks/ci/vendor/config/git-cliff.toml ${old_ref}..${ref} > ../charts-repo/release_notes.md
popd

export GH_TOKEN="$(gh-token generate -b "${GH_APP_PRIVATE_KEY}" -i "${GH_APP_ID}" | jq -r '.token')"

breaking=""
if [[ $(cat release_notes.md | grep breaking) != '' ]]; then
  breaking="--label breaking"
fi

gh pr close ${BOT_BRANCH} || true
gh pr create \
  --title "chore(deps): bump-${APP}-image-${ref}" \
  --body-file ../body.md \
  --base ${BRANCH} \
  --head ${BOT_BRANCH} \
  --label galoybot \
  --label galoy ${breaking}
