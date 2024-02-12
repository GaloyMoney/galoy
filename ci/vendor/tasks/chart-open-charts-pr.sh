#!/bin/bash

#! Auto synced from Shared CI Resources repository
#! Don't change this file, instead change it in github.com/GaloyMoney/concourse-shared

set -eu

export digest=$(cat ./edge-image/digest)
export ref=$(cat ./repo/.git/short_ref)

pushd charts-repo

git checkout ${BRANCH}

old_digest=$(yq e '.image.digest' "./charts/${CHARTS_SUBDIR}/values.yaml")
old_ref=$(grep "digest: \"${old_digest}\"" "./charts/${CHARTS_SUBDIR}/values.yaml" \
  | sed -n 's/.*commit_ref=\([^;]*\);.*/\1/p' | tr -d ' \n')

cat <<EOF >> ../body.md
# Bump ${CHARTS_SUBDIR} image

The ${CHARTS_SUBDIR} image will be bumped to digest:
```
${digest}
```

Code diff contained in this image:

https://github.com/GaloyMoney/${CHARTS_SUBDIR}/compare/${old_ref}...${ref}
EOF

gh pr close ${BOT_BRANCH} || true
gh pr create \
  --title chore-bump-${CHARTS_SUBDIR}-image-${ref} \
  --body-file ../body.md \
  --base ${BRANCH} \
  --head ${BOT_BRANCH} \
  --label galoybot \
  --label ${CHARTS_SUBDIR}
