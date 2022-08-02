import { GT } from "@graphql/index"

import UserRequestAuthCodeMutation from "@graphql/root/mutation/user-request-auth-code"
import UserLoginMutation from "@graphql/root/mutation/user-login"
import CaptchaRequestAuthCodeMutation from "@graphql/root/mutation/captcha-request-auth-code"
import CaptchaCreateChallengeMutation from "@graphql/root/mutation/captcha-create-challenge"
import AccountUpdateLevelMutation from "@graphql/admin/root/mutation/account-update-level"
import AccountUpdateStatusMutation from "@graphql/admin/root/mutation/account-update-status"
import AccountsAddUsdWalletMutation from "@graphql/admin/root/mutation/account-add-usd-wallet"
import AccountCustomFieldsUpdateMutation from "@graphql/admin/root/mutation/account-custom-fields-update"
import BusinessUpdateMapInfoMutation from "@graphql/admin/root/mutation/business-update-map-info"
import ColdStorageRebalanceToHotWalletMutation from "@graphql/admin/root/mutation/cold-storage-rebalance-to-hot-wallet"

const MutationType = GT.Object({
  name: "Mutation",
  fields: () => ({
    userRequestAuthCode: UserRequestAuthCodeMutation,
    userLogin: UserLoginMutation,

    captchaCreateChallenge: CaptchaCreateChallengeMutation,
    captchaRequestAuthCode: CaptchaRequestAuthCodeMutation,

    accountUpdateLevel: AccountUpdateLevelMutation,
    accountUpdateStatus: AccountUpdateStatusMutation,
    accountsAddUsdWallet: AccountsAddUsdWalletMutation,
    accountCustomFieldsUpdate: AccountCustomFieldsUpdateMutation,

    businessUpdateMapInfo: BusinessUpdateMapInfoMutation,

    coldStorageRebalanceToHotWallet: ColdStorageRebalanceToHotWalletMutation,
  }),
})

export default MutationType
