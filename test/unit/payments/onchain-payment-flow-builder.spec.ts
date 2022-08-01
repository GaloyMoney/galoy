import { getFeesConfig } from "@config"

import { SettlementMethod, PaymentInitiationMethod, OnChainFees } from "@domain/wallets"
import { SelfPaymentError } from "@domain/errors"
import { InvalidOnChainPaymentFlowBuilderStateError } from "@domain/payments"
import {
  AmountCalculator,
  paymentAmountFromNumber,
  ValidationError,
  WalletCurrency,
} from "@domain/shared"
import { OnChainPaymentFlowBuilder } from "@domain/payments/onchain-payment-flow-builder"
import { toSats } from "@domain/bitcoin"
import { ImbalanceCalculator } from "@domain/ledger/imbalance-calculator"

const calc = AmountCalculator()
const feeConfig = getFeesConfig()

describe("OnChainPaymentFlowBuilder", () => {
  const address = "address" as OnChainAddress
  const uncheckedAmount = 10000

  const senderBtcWallet = {
    id: "senderWalletId" as WalletId,
    currency: WalletCurrency.Btc,
  }
  const senderAccount = { withdrawFee: toSats(100) } as Account
  const recipientBtcWallet = {
    id: "recipientWalletId" as WalletId,
    currency: WalletCurrency.Btc,
    username: "Username" as Username,
  }
  const senderUsdWallet = {
    id: "walletId" as WalletId,
    currency: WalletCurrency.Usd,
  }
  const recipientUsdWallet = {
    id: "recipientWalletId" as WalletId,
    currency: WalletCurrency.Usd,
    username: "Username" as Username,
  }

  // ~0.045 ratio (0.045 cents/sat, or $45,455 USD/BTC)
  const inverseMidPriceRatio = 22n
  const mulByMidPriceRatio = (amount: bigint): bigint => amount / inverseMidPriceRatio
  const mulCeilByMidPriceRatio = (amount: bigint): bigint =>
    calc.divCeil({ amount, currency: WalletCurrency.Btc }, inverseMidPriceRatio).amount
  const divByMidPriceRatio = (amount: bigint): bigint => amount * inverseMidPriceRatio

  // ~0.3448 ratio (~32% spread on 0.045 cents/sat rate)
  const inverseDealerPriceRatio = 29n
  const mulByDealerPriceRatio = (amount: bigint): bigint =>
    calc.divRound({ amount, currency: WalletCurrency.Btc }, inverseDealerPriceRatio)
      .amount
  // const mulCeilByDealerPriceRatio = (amount: bigint): bigint =>
  //   calc.divCeil({ amount, currency: WalletCurrency.Btc }, inverseDealerPriceRatio).amount
  const divByDealerPriceRatio = (amount: bigint): bigint =>
    amount * inverseDealerPriceRatio

  const usdFromBtcMidPriceFn = async (amount: BtcPaymentAmount) => {
    return Promise.resolve({
      amount: mulByMidPriceRatio(amount.amount),
      currency: WalletCurrency.Usd,
    })
  }
  const btcFromUsdMidPriceFn = async (amount: UsdPaymentAmount) => {
    return Promise.resolve({
      amount: divByMidPriceRatio(amount.amount),
      currency: WalletCurrency.Btc,
    })
  }
  const usdFromBtc = async (amount: BtcPaymentAmount) => {
    return Promise.resolve({
      amount: mulByDealerPriceRatio(amount.amount),
      currency: WalletCurrency.Usd,
    })
  }
  const btcFromUsd = async (amount: UsdPaymentAmount) => {
    return Promise.resolve({
      amount: divByDealerPriceRatio(amount.amount),
      currency: WalletCurrency.Btc,
    })
  }

  const volumeLightningFn = async () =>
    Promise.resolve({
      outgoingBaseAmount: toSats(1000),
      incomingBaseAmount: toSats(1000),
    })

  const volumeOnChainFn = async () =>
    Promise.resolve({
      outgoingBaseAmount: toSats(1000),
      incomingBaseAmount: toSats(1000),
    })

  describe("onchain initiated", () => {
    const onChainBuilder = OnChainPaymentFlowBuilder({
      usdFromBtcMidPriceFn,
      btcFromUsdMidPriceFn,
      volumeLightningFn,
      volumeOnChainFn,
      isExternalAddress: async (address: OnChainAddress) => Promise.resolve(!!address),
    })
    const checkSettlementMethod = (payment) => {
      expect(payment).toEqual(
        expect.objectContaining({
          settlementMethod: SettlementMethod.OnChain,
          paymentInitiationMethod: PaymentInitiationMethod.OnChain,
        }),
      )
    }

    describe("with address", () => {
      const withAddressBuilder = onChainBuilder.withAddress(address)
      const checkAddress = (payment) => {
        expect(payment).toEqual(
          expect.objectContaining({
            address,
          }),
        )
      }

      describe("with btc wallet", () => {
        const withBtcWalletBuilder = withAddressBuilder.withSenderWalletAndAccount({
          wallet: senderBtcWallet,
          account: senderAccount,
        })

        const checkSenderWallet = (payment) => {
          expect(payment).toEqual(
            expect.objectContaining({
              senderWalletId: senderBtcWallet.id,
              senderWalletCurrency: senderBtcWallet.currency,
              senderWithdrawFee: senderAccount.withdrawFee,
            }),
          )
        }

        const thresholdImbalanceAmount = paymentAmountFromNumber({
          amount: feeConfig.withdrawThreshold,
          currency: WalletCurrency.Btc,
        })
        if (thresholdImbalanceAmount instanceof Error) throw thresholdImbalanceAmount

        const onChainFees = OnChainFees({
          feeRatioAsBasisPoints: feeConfig.withdrawRatioAsBasisPoints,
          thresholdImbalance: thresholdImbalanceAmount,
        })

        describe("onchain settled", () => {
          describe("without recipient wallet", () => {
            describe("with amount", () => {
              const withAmountBuilder = withBtcWalletBuilder
                .withoutRecipientWallet()
                .withAmount(uncheckedAmount)
              const checkAmount = (payment) => {
                expect(payment).toEqual(
                  expect.objectContaining({
                    btcPaymentAmount: {
                      amount: BigInt(uncheckedAmount),
                      currency: WalletCurrency.Btc,
                    },
                    inputAmount: BigInt(uncheckedAmount),
                  }),
                )
              }

              it.only("correctly applies miner, bank and imbalance fees", async () => {
                const minerFee = { amount: 300n, currency: WalletCurrency.Btc }
                const payment = await withAmountBuilder
                  .withConversion({
                    usdFromBtc,
                    btcFromUsd,
                  })
                  .withMinerFee(minerFee)
                if (payment instanceof Error) throw payment

                const usdPaymentAmount = {
                  amount: mulByMidPriceRatio(BigInt(uncheckedAmount)),
                  currency: WalletCurrency.Usd,
                }

                const sendAmount = paymentAmountFromNumber({
                  amount: uncheckedAmount,
                  currency: WalletCurrency.Btc,
                })
                if (sendAmount instanceof Error) throw sendAmount

                const minBankFee = paymentAmountFromNumber({
                  amount: senderAccount.withdrawFee,
                  currency: WalletCurrency.Btc,
                })
                if (minBankFee instanceof Error) return minBankFee

                const imbalanceCalculator = ImbalanceCalculator({
                  method: feeConfig.withdrawMethod,
                  volumeLightningFn,
                  volumeOnChainFn,
                  sinceDaysAgo: feeConfig.withdrawDaysLookback,
                })
                const imbalance = await imbalanceCalculator.getSwapOutImbalanceAmount(
                  senderBtcWallet,
                )
                if (imbalance instanceof Error) return imbalance

                const withdrawFees = onChainFees.withdrawalFee({
                  minerFee,
                  amount: sendAmount,
                  minBankFee,
                  imbalance,
                })
                if (withdrawFees instanceof Error) return withdrawFees
                expect(withdrawFees).not.toBeInstanceOf(Error)

                const btcProtocolFee = withdrawFees.totalFee
                const usdProtocolFee = {
                  amount: mulCeilByMidPriceRatio(btcProtocolFee.amount),
                  currency: WalletCurrency.Usd,
                }

                checkAddress(payment)
                checkSettlementMethod(payment)
                checkAmount(payment)
                checkSenderWallet(payment)
                // TODO: REACHED HERE, debug dealer vs. mid price in builder
                console.log("HERE 0:", payment)
                console.log("HERE 1:", {
                  usdPaymentAmount,
                  btcProtocolFee,
                  usdProtocolFee,
                })
                expect(payment).toEqual(
                  expect.objectContaining({
                    usdPaymentAmount,
                    btcProtocolFee,
                    usdProtocolFee,
                  }),
                )
              })
            })
          })
        })

        describe("intraledger settled", () => {
          describe("with btc recipient wallet", () => {
            const checkRecipientWallet = (payment) => {
              expect(payment).toEqual(
                expect.objectContaining({
                  recipientWalletId: recipientBtcWallet.id,
                  recipientWalletCurrency: recipientBtcWallet.currency,
                  recipientUsername: recipientBtcWallet.username,
                }),
              )
            }

            describe("with amount", () => {
              const withAmountBuilder = withBtcWalletBuilder
                .withRecipientWallet(recipientBtcWallet)
                .withAmount(uncheckedAmount)
              const checkAmount = (payment) => {
                expect(payment).toEqual(
                  expect.objectContaining({
                    btcPaymentAmount: {
                      amount: BigInt(uncheckedAmount),
                      currency: WalletCurrency.Btc,
                    },
                    inputAmount: BigInt(uncheckedAmount),
                  }),
                )
              }

              it("correctly applies no fees", async () => {
                const payment = await withAmountBuilder
                  .withConversion({
                    usdFromBtc,
                    btcFromUsd,
                  })
                  .withoutMinerFee()
                if (payment instanceof Error) throw payment

                const usdPaymentAmount = {
                  amount: mulByMidPriceRatio(BigInt(uncheckedAmount)),
                  currency: WalletCurrency.Usd,
                }

                checkAddress(payment)
                checkSettlementMethod(payment)
                checkAmount(payment)
                checkSenderWallet(payment)
                checkRecipientWallet(payment)
                expect(payment).toEqual(
                  expect.objectContaining({
                    usdPaymentAmount,
                    btcProtocolFee: onChainFees.intraLedgerFees().btc,
                    usdProtocolFee: onChainFees.intraLedgerFees().btc,
                  }),
                )
              })
            })
          })

          describe("with usd recipient wallet", () => {
            const checkRecipientWallet = (payment) => {
              expect(payment).toEqual(
                expect.objectContaining({
                  recipientWalletId: recipientUsdWallet.id,
                  recipientWalletCurrency: recipientUsdWallet.currency,
                  recipientUsername: recipientUsdWallet.username,
                }),
              )
            }

            describe("with amount", () => {
              const withAmountBuilder = withBtcWalletBuilder
                .withRecipientWallet(recipientUsdWallet)
                .withAmount(uncheckedAmount)
              const checkAmount = (payment) => {
                expect(payment).toEqual(
                  expect.objectContaining({
                    btcPaymentAmount: {
                      amount: BigInt(uncheckedAmount),
                      currency: WalletCurrency.Btc,
                    },
                    inputAmount: BigInt(uncheckedAmount),
                  }),
                )
              }

              it("correctly applies no fees", async () => {
                const payment = await withAmountBuilder
                  .withConversion({
                    usdFromBtc,
                    btcFromUsd,
                  })
                  .withoutMinerFee()
                if (payment instanceof Error) throw payment

                const usdPaymentAmount = {
                  amount: mulByMidPriceRatio(BigInt(uncheckedAmount)),
                  currency: WalletCurrency.Usd,
                }

                checkAddress(payment)
                checkSettlementMethod(payment)
                checkAmount(payment)
                checkSenderWallet(payment)
                checkRecipientWallet(payment)
                expect(payment).toEqual(
                  expect.objectContaining({
                    usdPaymentAmount,
                    btcProtocolFee: onChainFees.intraLedgerFees().btc,
                    usdProtocolFee: onChainFees.intraLedgerFees().btc,
                  }),
                )
              })
            })
          })
        })
      })

      describe("with usd wallet", () => {
        const withUsdWalletBuilder = withAddressBuilder.withSenderWalletAndAccount({
          wallet: senderUsdWallet,
          account: senderAccount,
        })

        const checkSenderWallet = (payment) => {
          expect(payment).toEqual(
            expect.objectContaining({
              senderWalletId: senderUsdWallet.id,
              senderWalletCurrency: senderUsdWallet.currency,
              senderWithdrawFee: senderAccount.withdrawFee,
            }),
          )
        }

        const thresholdImbalanceAmount = paymentAmountFromNumber({
          amount: feeConfig.withdrawThreshold,
          currency: WalletCurrency.Btc,
        })
        if (thresholdImbalanceAmount instanceof Error) throw thresholdImbalanceAmount

        const onChainFees = OnChainFees({
          feeRatioAsBasisPoints: feeConfig.withdrawRatioAsBasisPoints,
          thresholdImbalance: thresholdImbalanceAmount,
        })

        describe("onchain settled", () => {
          describe("without recipient wallet", () => {
            describe("with amount", () => {
              const withAmountBuilder = withUsdWalletBuilder
                .withoutRecipientWallet()
                .withAmount(uncheckedAmount)
              const checkAmount = (payment) => {
                expect(payment).toEqual(
                  // TODO: check that btcPaymentAmount doesn't exist?
                  expect.objectContaining({
                    usdPaymentAmount: {
                      amount: BigInt(uncheckedAmount),
                      currency: WalletCurrency.Usd,
                    },
                    inputAmount: BigInt(uncheckedAmount),
                  }),
                )
              }

              it("correctly applies miner, bank and imbalance fees", async () => {
                const minerFee = { amount: 300n, currency: WalletCurrency.Btc }
                const payment = await withAmountBuilder
                  .withConversion({
                    usdFromBtc,
                    btcFromUsd,
                  })
                  .withMinerFee(minerFee)
                if (payment instanceof Error) throw payment

                const btcPaymentAmount = {
                  amount: divByDealerPriceRatio(BigInt(uncheckedAmount)),
                  currency: WalletCurrency.Btc,
                }

                const sendAmount = paymentAmountFromNumber({
                  amount: uncheckedAmount,
                  currency: WalletCurrency.Usd,
                })
                if (sendAmount instanceof Error) throw sendAmount

                const minBankFee = paymentAmountFromNumber({
                  amount: senderAccount.withdrawFee,
                  currency: WalletCurrency.Btc,
                })
                if (minBankFee instanceof Error) return minBankFee

                const imbalanceCalculator = ImbalanceCalculator({
                  method: feeConfig.withdrawMethod,
                  volumeLightningFn,
                  volumeOnChainFn,
                  sinceDaysAgo: feeConfig.withdrawDaysLookback,
                })
                const imbalanceForWallet =
                  await imbalanceCalculator.getSwapOutImbalanceAmount(senderUsdWallet)
                if (imbalanceForWallet instanceof Error) return imbalanceForWallet

                const imbalance = {
                  amount: divByDealerPriceRatio(imbalanceForWallet.amount),
                  currency: WalletCurrency.Btc,
                }

                const btcProtocolFee = onChainFees.withdrawalFee({
                  minerFee,
                  amount: btcPaymentAmount,
                  minBankFee,
                  imbalance,
                })
                if (btcProtocolFee instanceof Error) return btcProtocolFee
                expect(btcProtocolFee).not.toBeInstanceOf(Error)

                const usdProtocolFee = {
                  amount: mulCeilByMidPriceRatio(btcProtocolFee.totalFee.amount),
                  currency: WalletCurrency.Usd,
                }

                checkAddress(payment)
                checkSettlementMethod(payment)
                checkAmount(payment)
                checkSenderWallet(payment)
                expect(payment).toEqual(
                  expect.objectContaining({
                    btcPaymentAmount,
                    btcProtocolFee,
                    usdProtocolFee,
                  }),
                )
              })
            })
          })
        })

        describe("intraledger settled", () => {
          describe("with btc recipient wallet", () => {
            const checkRecipientWallet = (payment) => {
              expect(payment).toEqual(
                expect.objectContaining({
                  recipientWalletId: recipientBtcWallet.id,
                  recipientWalletCurrency: recipientBtcWallet.currency,
                  recipientUsername: recipientBtcWallet.username,
                }),
              )
            }

            describe("with amount", () => {
              const withAmountBuilder = withUsdWalletBuilder
                .withRecipientWallet(recipientBtcWallet)
                .withAmount(uncheckedAmount)
              const checkAmount = (payment) => {
                expect(payment).toEqual(
                  expect.objectContaining({
                    usdPaymentAmount: {
                      amount: BigInt(uncheckedAmount),
                      currency: WalletCurrency.Usd,
                    },
                    inputAmount: BigInt(uncheckedAmount),
                  }),
                )
              }

              it("correctly applies no fees", async () => {
                const payment = await withAmountBuilder
                  .withConversion({
                    usdFromBtc,
                    btcFromUsd,
                  })
                  .withoutMinerFee()
                if (payment instanceof Error) throw payment

                const btcPaymentAmount = {
                  amount: divByMidPriceRatio(BigInt(uncheckedAmount)),
                  currency: WalletCurrency.Btc,
                }

                checkAddress(payment)
                checkSettlementMethod(payment)
                checkAmount(payment)
                checkSenderWallet(payment)
                checkRecipientWallet(payment)
                expect(payment).toEqual(
                  expect.objectContaining({
                    btcPaymentAmount,
                    btcProtocolFee: onChainFees.intraLedgerFees().btc,
                    usdProtocolFee: onChainFees.intraLedgerFees().btc,
                  }),
                )
              })
            })
          })

          describe("with usd recipient wallet", () => {
            const checkRecipientWallet = (payment) => {
              expect(payment).toEqual(
                expect.objectContaining({
                  recipientWalletId: recipientUsdWallet.id,
                  recipientWalletCurrency: recipientUsdWallet.currency,
                  recipientUsername: recipientUsdWallet.username,
                }),
              )
            }

            describe("with amount", () => {
              const withAmountBuilder = withUsdWalletBuilder
                .withRecipientWallet(recipientUsdWallet)
                .withAmount(uncheckedAmount)
              const checkAmount = (payment) => {
                expect(payment).toEqual(
                  expect.objectContaining({
                    usdPaymentAmount: {
                      amount: BigInt(uncheckedAmount),
                      currency: WalletCurrency.Usd,
                    },
                    inputAmount: BigInt(uncheckedAmount),
                  }),
                )
              }

              it("correctly applies no fees", async () => {
                const payment = await withAmountBuilder
                  .withConversion({
                    usdFromBtc,
                    btcFromUsd,
                  })
                  .withoutMinerFee()
                if (payment instanceof Error) throw payment

                const btcPaymentAmount = {
                  amount: divByMidPriceRatio(BigInt(uncheckedAmount)),
                  currency: WalletCurrency.Btc,
                }

                checkAddress(payment)
                checkSettlementMethod(payment)
                checkAmount(payment)
                checkSenderWallet(payment)
                checkRecipientWallet(payment)
                expect(payment).toEqual(
                  expect.objectContaining({
                    btcPaymentAmount,
                    btcProtocolFee: onChainFees.intraLedgerFees().btc,
                    usdProtocolFee: onChainFees.intraLedgerFees().btc,
                  }),
                )
              })
            })
          })
        })
      })
    })
  })

  describe("error states", () => {
    describe("pass an empty value to withAddress", () => {
      it("returns a ValidationError", async () => {
        const isIntraLedger = false
        const minerFee = { amount: 300n, currency: WalletCurrency.Btc }

        const payment = await OnChainPaymentFlowBuilder({
          usdFromBtcMidPriceFn,
          btcFromUsdMidPriceFn,
          volumeLightningFn,
          volumeOnChainFn,
          isExternalAddress: async () => Promise.resolve(!isIntraLedger),
        })
          .withAddress("" as OnChainAddress)
          .withSenderWalletAndAccount({
            wallet: senderBtcWallet,
            account: senderAccount,
          })
          .withoutRecipientWallet()
          .withAmount(uncheckedAmount)
          .withConversion({
            usdFromBtc,
            btcFromUsd,
          })
          .withMinerFee(minerFee)

        expect(payment).toBeInstanceOf(InvalidOnChainPaymentFlowBuilderStateError)
      })
    })
    describe("non-integer uncheckedAmount", () => {
      it("returns a ValidationError", async () => {
        const isIntraLedger = false
        const minerFee = { amount: 300n, currency: WalletCurrency.Btc }

        const payment = await OnChainPaymentFlowBuilder({
          usdFromBtcMidPriceFn,
          btcFromUsdMidPriceFn,
          volumeLightningFn,
          volumeOnChainFn,
          isExternalAddress: async () => Promise.resolve(!isIntraLedger),
        })
          .withAddress("address" as OnChainAddress)
          .withSenderWalletAndAccount({
            wallet: senderBtcWallet,
            account: senderAccount,
          })
          .withoutRecipientWallet()
          .withAmount(0.4)
          .withConversion({
            usdFromBtc,
            btcFromUsd,
          })
          .withMinerFee(minerFee)

        expect(payment).toBeInstanceOf(ValidationError)
      })
    })
    describe("zero-value uncheckedAmount", () => {
      it("returns a ValidationError", async () => {
        const isIntraLedger = false
        const minerFee = { amount: 300n, currency: WalletCurrency.Btc }

        const payment = await OnChainPaymentFlowBuilder({
          usdFromBtcMidPriceFn,
          btcFromUsdMidPriceFn,
          volumeLightningFn,
          volumeOnChainFn,
          isExternalAddress: async () => Promise.resolve(!isIntraLedger),
        })
          .withAddress("address" as OnChainAddress)
          .withSenderWalletAndAccount({
            wallet: senderBtcWallet,
            account: senderAccount,
          })
          .withoutRecipientWallet()
          .withAmount(0)
          .withConversion({
            usdFromBtc,
            btcFromUsd,
          })
          .withMinerFee(minerFee)

        expect(payment).toBeInstanceOf(ValidationError)
      })
    })

    describe("no recipient wallet despite IntraLedger", () => {
      it("returns InvalidLightningPaymentFlowBuilderStateError", async () => {
        const isIntraLedger = false
        const payment = await OnChainPaymentFlowBuilder({
          usdFromBtcMidPriceFn,
          btcFromUsdMidPriceFn,
          volumeLightningFn,
          volumeOnChainFn,
          isExternalAddress: async () => Promise.resolve(isIntraLedger),
        })
          .withAddress("address" as OnChainAddress)
          .withSenderWalletAndAccount({
            wallet: senderBtcWallet,
            account: senderAccount,
          })
          .withoutRecipientWallet()
          .withAmount(uncheckedAmount)
          .withConversion({
            usdFromBtc,
            btcFromUsd,
          })
          .withoutMinerFee()

        expect(payment).toBeInstanceOf(InvalidOnChainPaymentFlowBuilderStateError)
      })
    })

    describe("sender and recipient are identical", () => {
      it("returns ImpossibleLightningPaymentFlowBuilderStateError", async () => {
        const isIntraLedger = false
        const payment = await OnChainPaymentFlowBuilder({
          usdFromBtcMidPriceFn,
          btcFromUsdMidPriceFn,
          volumeLightningFn,
          volumeOnChainFn,
          isExternalAddress: async () => Promise.resolve(!isIntraLedger),
        })
          .withAddress("address" as OnChainAddress)
          .withSenderWalletAndAccount({
            wallet: senderBtcWallet,
            account: senderAccount,
          })
          .withRecipientWallet(senderBtcWallet)
          .withAmount(uncheckedAmount)
          .withConversion({
            usdFromBtc,
            btcFromUsd,
          })
          .withoutMinerFee()

        expect(payment).toBeInstanceOf(SelfPaymentError)
      })
    })
  })
})
