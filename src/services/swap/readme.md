Swap Service 
============

(1) Start the loopserver (regtest LL loop server) and loopd (Rest API)
---------------------------------------
```sh
make start-loop
```

A successful loop server start returns this
```json
{
  "swap_fee_sat":"50", 
  "prepay_amt_sat":"1337", 
  "htlc_sweep_fee_sat":"7262", 
  "swap_payment_dest":"A31dVAIzvYn1p/0J7WG3DS7Qbq5FIzWhPgtHQngozskq",
  "cltv_delta":0, 
  "conf_target":9
}
```

(2) Configure the loop params in `default.yaml`
---------------------------------------

```yaml
swap:
  minOutboundLiquidityBalance: 2000000
  loopRestEndpoint: "https://localhost:8081"
  loopRpcEndpoint: "localhost:11010"
  swapOutAmount: 500000 
  swapProviders: ["LOOP"] 
```

(3) Choose the swap provider
---------------------------------------

By default we use the lightning-labs `loop` swap provider, but there is an `ISwapProvider` interface that third party contributors can code against. For example, they could create a Boltz swap provider by configuring the `loopProvider` parameter in the `default.yaml` file, then follow the lightning-labs provider as an example here `src/services/swap/providers/lightning-labs`. 

```typescript
import SwapProvider from "./providers/lightning-labs/loop-swap-provider"

// do swap out
const resp = await SwapProvider.swapOut(swapOutAmount)
```


(4) Test a Loop Out
---------------------------------------
```sh
TEST="swap-out-checker" make unit
TEST="swap-listener" make integration
TEST="swap-out" make integration
```

(5) Monitor Status of the swap
----------------------------
@todo rest call

```
LOOP_MACAROON=$(cat dev/lnd/loop.macaroon | xxd -p |  awk '{print}' ORS='')
curl -k \
    --request GET \
    --url     https://localhost:8081/v1/loop/swaps \
    --cert     dev/lnd/tls.cert \
    --key      dev/lnd/tls.key \
    --header  'Content-Type: application/json' \
    --header  "Grpc-Metadata-macaroon: $LOOP_MACAROON" \
    --verbose \
    | yarn pino-pretty -c -l
```


Generate GRPC Types
====================
```
cd src/services/swap/providers/lightning-labs/protos/generated
$(npm bin)/proto-loader-gen-types --longs=String --enums=String --defaults --oneofs --grpcLib=@grpc/grpc-js --outDir=./ ../loop.proto
```

Troubleshooting
=============
If you get the error
```
Waiting for lnd to be fully synced to its chain backend, this might take a while
```
Then the chain is not synced. Try running `make mine`