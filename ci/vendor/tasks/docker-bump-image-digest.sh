#!/bin/bash

#! Auto synced from Shared CI Resources repository
#! Don't change this file, instead change it in github.com/GaloyMoney/concourse-shared

set -eu

export digest=$(cat ./edge-image/digest)
export ref=$(cat ./repo/.git/short_ref)
export app_version=$(cat version/version)

pushd charts-repo

yq -i e '.image.digest = strenv(digest)' ./charts/${CHARTS_SUBDIR}/values.yaml

sed -i "s|\(digest: \"${digest}\"\).*$|\1 # METADATA:: repository=https://github.com/GaloyMoney/${CHARTS_SUBDIR};commit_ref=${ref};app=${CHARTS_SUBDIR};|g" "./charts/${CHARTS_SUBDIR}/values.yaml"

yq -i e '.appVersion = strenv(app_version)' ./charts/${CHARTS_SUBDIR}/Chart.yaml

if [[ -z $(git config --global user.email) ]]; then
  git config --global user.email "bot@galoy.io"
fi
if [[ -z $(git config --global user.name) ]]; then
  git config --global user.name "CI Bot"
fi

(
  cd $(git rev-parse --show-toplevel)
  git merge --no-edit ${BRANCH}
  git add -A
  git status
  git commit -m "chore(${CHARTS_SUBDIR}): bump ${CHARTS_SUBDIR} image to '${digest}'"
)
