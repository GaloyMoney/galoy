export CARGO_HOME="$(pwd)/cargo-home"
export CARGO_TARGET_DIR="$(pwd)/cargo-target-dir"

function unpack_deps() {
  REPO_PATH=${REPO_PATH:-repo}

  if [[ -f ${REPO_PATH}/yarn.lock ]]; then
    echo "Unpacking nodejs deps... "

    pushd ${REPO_PATH} > /dev/null

    tar -zxvf ../bundled-deps/bundled-deps-*.tgz ./node_modules/ ./yarn.lock > /dev/null

    if [[ "$(git status -s -uno)" != "" ]]; then
      echo "Extracting deps has created a diff - deps are not in sync"
      git --no-pager diff
      exit 1;
    fi

    echo "Done!"

    popd
  else
    echo "Skipping unpack deps"
  fi
}
