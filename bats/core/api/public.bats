#!/usr/bin/env bats

load "../../helpers/_common.bash"
load "../../helpers/subscriber.bash"

@test "public: can query globals" {
  exec_graphql 'anon' 'globals'
  network="$(graphql_output '.data.globals.network')"
  [[ "${network}" = "regtest" ]] || exit 1
}

@test "public: can apply idempotency key to queries" {
  fixed_idempotency_key=$(new_idempotency_key)
  original_new_idempotency_key=$(declare -f new_idempotency_key)
  new_idempotency_key() {
    echo $fixed_idempotency_key
  }

  # Successful 1st attempt
  exec_graphql 'anon' 'globals'
  errors="$(graphql_output '.errors')"
  [[ "$errors" == "null" ]] || exit 1

  # Failed 2nd attempt with same idempotency key
  exec_graphql 'anon' 'globals'
  error_msg="$(graphql_output '.errors[0].message')"
  [[ "$error_msg" == "HTTP fetch failed from 'public': 409: Conflict" ]] || exit 1

  # Failed attempt with invalid idempotency key
  new_idempotency_key() {
    echo "invalid-key"
  }
  exec_graphql 'anon' 'globals'
  error_msg="$(graphql_output '.errors[0].message')"
  [[ "$error_msg" == "HTTP fetch failed from 'public': 400: Bad Request" ]] || exit 1

  # Successful 3rd attempt with unique valid idempotency key
  eval "$original_new_idempotency_key"
  exec_graphql 'anon' 'globals'
  [[ "$errors" == "null" ]] || exit 1
}

@test "public: can subscribe to price" {
  subscribe_to 'anon' price-sub
  retry 10 1 grep 'Data.*\bprice\b' .e2e-subscriber.log

  num_errors=$(
    grep 'Data.*\bprice\b' .e2e-subscriber.log \
      | awk '{print $2}' \
      | jq -r '.data.price.errors | length'
  )
  [[ "$num_errors" == "0" ]] || exit 1

  stop_subscriber
}
