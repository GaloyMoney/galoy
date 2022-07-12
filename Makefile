BIN_DIR=node_modules/.bin

start-deps:
	docker compose up integration-deps -d
	direnv reload

update-price-history:
	docker compose run price-history node servers/history/cron.js

start-main:
	. ./.envrc && yarn tsnd --respawn --files -r tsconfig-paths/register -r src/services/tracing.ts \
		src/servers/graphql-main-server.ts | yarn pino-pretty -c -l

start-admin:
	. ./.envrc && yarn tsnd --respawn --files -r tsconfig-paths/register -r src/services/tracing.ts \
		src/servers/graphql-admin-server.ts | yarn pino-pretty -c -l

start-trigger: start-deps
	. ./.envrc && yarn tsnd --respawn --files -r tsconfig-paths/register -r src/services/tracing.ts \
		src/servers/trigger.ts | yarn pino-pretty -c -l

start-cron: start-deps
	. ./.envrc && yarn tsnd --files -r tsconfig-paths/register -r src/services/tracing.ts \
		src/servers/cron.ts | yarn pino-pretty -c -l

start-loop:
	./dev/scripts/start-loop.sh

start: start-deps
	make start-main & make start-admin & make start-trigger

start-api-ci:
	node lib/servers/graphql-main-server.js

exporter: start-deps
	. ./.envrc && yarn tsnd --respawn --files -r tsconfig-paths/register -r src/services/tracing.ts \
		src/servers/exporter.ts | yarn pino-pretty -c -l

watch:
	yarn nodemon -V -e ts,graphql -w ./src -x make start

clean-deps:
	docker compose down

reset-deps: clean-deps start-deps

test: unit integration

test-migrate:
	docker compose down -v
	docker compose build
	docker compose up mongodb-migrate

unit:
	yarn test:unit

watch-unit:
	$(BIN_DIR)/jest --config ./test/jest-unit.config.js --clearCache
	NODE_ENV=test LOGLEVEL=warn $(BIN_DIR)/jest --watch --config ./test/jest-unit.config.js

watch-compile:
	$(BIN_DIR)/tsc --watch  --noEmit --skipLibCheck

e2e:
	yarn build && \
	yarn test:e2e

e2e-in-ci:
	docker compose -f docker-compose.yml up integration-deps -d && \
	make create-tmp-env-ci && \
	TMP_ENV_CI=tmp.env.ci docker compose -f docker-compose.yml up e2e-tests

execute-e2e-from-within-container:
	yarn install && \
	yarn build && \
	NODE_ENV=test LOGLEVEL=error $(BIN_DIR)/jest --config ./test/jest-e2e.config.js --bail --runInBand --ci --reporters=default --reporters=jest-junit

integration:
	yarn build && \
	yarn test:integration

reset-integration: reset-deps integration

reset-e2e: reset-deps e2e

integration-in-ci:
	docker compose -f docker-compose.yml up integration-deps -d && \
	make create-tmp-env-ci && \
	TMP_ENV_CI=tmp.env.ci docker compose -f docker-compose.yml up integration-tests

execute-integration-from-within-container:
	yarn install && \
	NODE_ENV=test LOGLEVEL=error $(BIN_DIR)/jest --config ./test/jest-integration.config.js --bail --runInBand --ci --reporters=default --reporters=jest-junit

unit-in-ci:
	. ./.envrc && \
		LOGLEVEL=warn $(BIN_DIR)/jest --config ./test/jest-unit.config.js --ci --bail

check-implicit:
	yarn tsc-check-noimplicitany

check-code:
	yarn tsc-check
	yarn eslint-check
	yarn build

create-tmp-env-ci:
	. ./.envrc && \
	envsubst < .env.ci > tmp.env.ci

# 16 is exit code for critical https://classic.yarnpkg.com/lang/en/docs/cli/audit
audit:
	bash -c 'yarn audit --level critical; [[ $$? -ge 16 ]] && exit 1 || exit 0'

mine:
	container_id=$$(docker ps -q -f status=running -f name="bitcoind"); \
	docker exec -it "$$container_id" /bin/sh -c 'ADDR=$$(bitcoin-cli getnewaddress "") && bitcoin-cli generatetoaddress 6 $$ADDR '
	