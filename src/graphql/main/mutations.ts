import { GT } from "@graphql/index"

import DeviceNotificationTokenCreateMutation from "@graphql/root/mutation/device-notification-token-create"
import IntraLedgerPaymentSendMutation from "@graphql/root/mutation/intraledger-payment-send"
import IntraLedgerUsdPaymentSendMutation from "@graphql/root/mutation/intraledger-usd-payment-send"
import LnInvoiceCreateMutation from "@graphql/root/mutation/ln-invoice-create"
import LnUsdInvoiceCreateMutation from "@graphql/root/mutation/ln-usd-invoice-create"
import LnInvoiceCreateOnBehalfOfRecipientMutation from "@graphql/root/mutation/ln-invoice-create-on-behalf-of-recipient"
import LnUsdInvoiceCreateOnBehalfOfRecipientMutation from "@graphql/root/mutation/ln-usd-invoice-create-on-behalf-of-recipient"
import LnInvoiceFeeProbeMutation from "@graphql/root/mutation/ln-invoice-fee-probe"
import LnUsdInvoiceFeeProbeMutation from "@graphql/root/mutation/ln-usd-invoice-fee-probe"
import LnInvoicePaymentSendMutation from "@graphql/root/mutation/ln-invoice-payment-send"
import LnNoAmountInvoiceCreateMutation from "@graphql/root/mutation/ln-noamount-invoice-create"
import LnNoAmountInvoiceCreateOnBehalfOfRecipientMutation from "@graphql/root/mutation/ln-noamount-invoice-create-on-behalf-of-recipient"
import LnNoAmountInvoiceFeeProbeMutation from "@graphql/root/mutation/ln-noamount-invoice-fee-probe"
import LnNoAmountUsdInvoiceFeeProbeMutation from "@graphql/root/mutation/ln-noamount-usd-invoice-fee-probe"
import LnNoAmountInvoicePaymentSendMutation from "@graphql/root/mutation/ln-noamount-invoice-payment-send"
import LnNoAmountUsdInvoicePaymentSendMutation from "@graphql/root/mutation/ln-noamount-usd-invoice-payment-send"
import OnChainAddressCreateMutation from "@graphql/root/mutation/on-chain-address-create"
import OnChainAddressCurrentMutation from "@graphql/root/mutation/on-chain-address-current"
import TwoFADeleteMutation from "@graphql/root/mutation/twofa-delete"
import TwoFAGenerateMutation from "@graphql/root/mutation/twofa-generate"
import TwoFASaveMutation from "@graphql/root/mutation/twofa-save"
import UserLoginMutation from "@graphql/root/mutation/user-login"
import UserRequestAuthCodeMutation from "@graphql/root/mutation/user-request-auth-code"
import UserUpdateLanguageMutation from "@graphql/root/mutation/user-update-language"
import UserUpdateUsernameMutation from "@graphql/root/mutation/user-update-username"
import AccountCustomFieldsUpdateMutation from "@graphql/root/mutation/account-custom-fields-update"
import AccountUpdateDefaultWalletIdMutation from "@graphql/root/mutation/account-update-default-wallet-id"
import UserContactUpdateAliasMutation from "@graphql/root/mutation/user-contact-update-alias"
import UserQuizQuestionUpdateCompletedMutation from "@graphql/root/mutation/user-quiz-question-update-completed"
import OnChainPaymentSendMutation from "@graphql/root/mutation/onchain-payment-send"
import OnChainPaymentSendAllMutation from "@graphql/root/mutation/onchain-payment-send-all"
import CaptchaRequestAuthCodeMutation from "@graphql/root/mutation/captcha-request-auth-code"
import CaptchaCreateChallengeMutation from "@graphql/root/mutation/captcha-create-challenge"

import {
  addAttributesToCurrentSpanAndPropagate,
  SemanticAttributes,
  ACCOUNT_USERNAME,
} from "@services/tracing"

// TODO: // const fields: { [key: string]: GraphQLFieldConfig<any, GraphQLContext> }
const fields = {
  // unauthed
  userRequestAuthCode: UserRequestAuthCodeMutation,
  userLogin: UserLoginMutation,

  captchaCreateChallenge: CaptchaCreateChallengeMutation,
  captchaRequestAuthCode: CaptchaRequestAuthCodeMutation,

  lnInvoiceCreateOnBehalfOfRecipient: LnInvoiceCreateOnBehalfOfRecipientMutation,
  lnUsdInvoiceCreateOnBehalfOfRecipient: LnUsdInvoiceCreateOnBehalfOfRecipientMutation,
  lnNoAmountInvoiceCreateOnBehalfOfRecipient:
    LnNoAmountInvoiceCreateOnBehalfOfRecipientMutation,

  // authed
  twoFAGenerate: TwoFAGenerateMutation,
  twoFASave: TwoFASaveMutation,
  twoFADelete: TwoFADeleteMutation,

  userQuizQuestionUpdateCompleted: UserQuizQuestionUpdateCompletedMutation,
  deviceNotificationTokenCreate: DeviceNotificationTokenCreateMutation,

  userUpdateLanguage: UserUpdateLanguageMutation,
  userUpdateUsername: UserUpdateUsernameMutation,
  userContactUpdateAlias: UserContactUpdateAliasMutation,

  accountCustomFieldsUpdate: AccountCustomFieldsUpdateMutation,
  accountUpdateDefaultWalletId: AccountUpdateDefaultWalletIdMutation,

  lnInvoiceFeeProbe: LnInvoiceFeeProbeMutation,
  lnUsdInvoiceFeeProbe: LnUsdInvoiceFeeProbeMutation,
  lnNoAmountInvoiceFeeProbe: LnNoAmountInvoiceFeeProbeMutation,
  lnNoAmountUsdInvoiceFeeProbe: LnNoAmountUsdInvoiceFeeProbeMutation,

  lnInvoiceCreate: LnInvoiceCreateMutation,
  lnUsdInvoiceCreate: LnUsdInvoiceCreateMutation,
  lnNoAmountInvoiceCreate: LnNoAmountInvoiceCreateMutation,

  lnInvoicePaymentSend: LnInvoicePaymentSendMutation,
  lnNoAmountInvoicePaymentSend: LnNoAmountInvoicePaymentSendMutation,
  lnNoAmountUsdInvoicePaymentSend: LnNoAmountUsdInvoicePaymentSendMutation,

  intraLedgerPaymentSend: IntraLedgerPaymentSendMutation,
  intraLedgerUsdPaymentSend: IntraLedgerUsdPaymentSendMutation,

  onChainAddressCreate: OnChainAddressCreateMutation,
  onChainAddressCurrent: OnChainAddressCurrentMutation,
  onChainPaymentSend: OnChainPaymentSendMutation,
  onChainPaymentSendAll: OnChainPaymentSendAllMutation,
}

const addTracing = () => {
  for (const key in fields) {
    // @ts-ignore-next-line no-implicit-any error
    const original = fields[key].resolve
    /* eslint @typescript-eslint/ban-ts-comment: "off" */
    // @ts-ignore-next-line no-implicit-any error
    fields[key].resolve = (source, args, context, info) => {
      const { ip, domainAccount, domainUser } = context
      return addAttributesToCurrentSpanAndPropagate(
        {
          [SemanticAttributes.ENDUSER_ID]: domainUser?.id,
          [ACCOUNT_USERNAME]: domainAccount?.username,
          [SemanticAttributes.HTTP_CLIENT_IP]: ip,
        },
        // @ts-ignore-next-line no-implicit-any error
        () => original(source, args, context, info),
      )
    }
  }
  return fields
}

const MutationType = GT.Object({
  name: "Mutation",
  fields: () => addTracing(),
})

export default MutationType
