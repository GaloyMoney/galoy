import {
  TransactionRestrictedError,
  LightningPaymentError,
  NotFoundError,
  SelfPaymentError,
  InsufficientBalanceError,
  DbError,
  UnknownClientError,
  InvoiceDecodeError,
  ValidationInternalError,
  TooManyRequestError,
  RouteFindingError,
  InvalidCoordinatesError,
  InvalidBusinessTitleLengthError,
  VerificationCodeError,
  UsernameError,
  DealerOfflineError,
  LndOfflineError,
  PhoneProviderError,
  UnexpectedClientError,
  DealerError,
  PhoneAccountAlreadyExistsError,
  PhoneAccountAlreadyExistsNeedToSweepFundsError,
  EmailUnverifiedError,
  AccountAlreadyHasEmailError,
  PhoneAlreadyExistsError,
  EmailAlreadyExistsError,
  SessionRefreshRequiredError,
  CodeExpiredError,
  UnauthorizedIPForOnboardingError,
  InvalidPhoneMetadataForOnboardingError,
  InvalidPhoneForOnboardingError,
  UnauthorizedIPError,
  UnauthorizedIPMetadataProxyError,
  UnauthorizedIPMetadataCountryError,
  LikelyBadCoreError,
  LnurlRequestInvoiceError,
  QuizClaimedTooEarlyError,
  PriceServiceOfflineError,
  OperationRestrictedError,
} from "@/graphql/error"
import { baseLogger } from "@/services/logger"

const assertUnreachable = (x: never): never => {
  throw new Error(`This should never compile with ${x}`)
}

export const mapError = (error: ApplicationError): CustomGraphQLError => {
  const errorName = error.name as ApplicationErrorKey
  let message = ""
  switch (errorName) {
    case "WithdrawalLimitsExceededError":
      message = error.message
      return new TransactionRestrictedError({ message, logger: baseLogger })

    case "IntraledgerLimitsExceededError":
      message = error.message
      return new TransactionRestrictedError({ message, logger: baseLogger })

    case "TradeIntraAccountLimitsExceededError":
      message = error.message
      return new TransactionRestrictedError({ message, logger: baseLogger })

    case "AlreadyPaidError":
      message = "Invoice is already paid"
      return new LightningPaymentError({ message, logger: baseLogger })

    case "CouldNotFindWalletInvoiceError":
      message = `User tried to pay invoice with hash ${error.message}, but it does not exist`
      return new LightningPaymentError({ message, logger: baseLogger })

    case "NoValidNodeForPubkeyError":
      message = `Temporary failure when trying to pay, please retry payment`
      return new LightningPaymentError({ message, logger: baseLogger })

    case "PaymentAttemptsTimedOutError":
      message = `Temporary failure when trying to pay, please try again later`
      return new LightningPaymentError({ message, logger: baseLogger })

    case "PaymentRejectedByDestinationError":
      message = `Payment was rejected by destination as invalid`
      return new LightningPaymentError({ message, logger: baseLogger })

    case "InvoiceExpiredOrBadPaymentHashError":
      message = `Invoice already expired, or has bad payment hash`
      return new LightningPaymentError({ message, logger: baseLogger })

    case "CouldNotFindUserFromIdError":
      message = `User does not exist for id ${error.message}`
      return new NotFoundError({ message, logger: baseLogger })

    case "CouldNotFindAccountFromIdError":
      message = `Account does not exist for id ${error.message}`
      return new NotFoundError({ message, logger: baseLogger })

    case "CouldNotFindAccountFromUsernameError":
      message = `Account does not exist for username ${error.message}`
      return new NotFoundError({ message, logger: baseLogger })

    case "CouldNotFindMerchantFromUsernameError":
      message = `Merchant does not exist for username ${error.message}`
      return new NotFoundError({ message, logger: baseLogger })

    case "CouldNotFindMerchantFromIdError":
      message = `Merchant does not exist for ID ${error.message}`
      return new NotFoundError({ message, logger: baseLogger })

    case "WalletInvoiceMissingLnInvoiceError":
      message = `The associated lightning invoice could not be found.`
      return new NotFoundError({ message, logger: baseLogger })

    case "CouldNotFindTransactionsForAccountError":
      message = "No transactions found for your account."
      return new NotFoundError({ message, logger: baseLogger })

    case "CouldNotFindUserFromPhoneError":
      message = `User does not exist for phone ${error.message}`
      return new NotFoundError({ message, logger: baseLogger })

    case "CouldNotFindUserFromWalletIdError":
      message = `User does not exist for wallet-id ${error.message}`
      return new NotFoundError({ message, logger: baseLogger })

    case "CouldNotFindUserFromEmailError":
      message = `User does not exist for email`
      return new NotFoundError({ message, logger: baseLogger })

    case "ContactNotExistentError":
      message = `Contact does not exist for account ${error.message}`
      return new NotFoundError({ message, logger: baseLogger })

    case "IdentifierNotFoundError":
      message = `Identifier does not exist ${error.message}`
      return new NotFoundError({ message, logger: baseLogger })

    case "SelfPaymentError":
      message = "User tried to pay themselves"
      return new SelfPaymentError({ message, logger: baseLogger })

    case "LnInvoiceMissingPaymentSecretError":
      message = "Invoice is missing its 'payment secret' value"
      return new InvoiceDecodeError({ message, logger: baseLogger })

    case "InvalidChecksumForLnInvoiceError":
      message = "Invoice has an invalid checksum, please check again"
      return new InvoiceDecodeError({ message, logger: baseLogger })

    case "LnPaymentRequestInTransitError":
      message = "There is a pending payment for this invoice"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "SatoshiAmountRequiredError":
      message = "An amount is required to complete payment"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidSatoshiAmountError":
      message = "A valid satoshi amount is required"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidBtcPaymentAmountError":
      message = "A valid satoshi amount is required"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidUsdPaymentAmountError":
      message = "A valid usd amount is required"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "BtcAmountTooLargeError":
      message = "Sats amount passed is too large"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "UsdAmountTooLargeError":
      message = "Usd cents amount passed is too large"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "LnPaymentRequestNonZeroAmountRequiredError":
      message = "Invoice does not have a valid amount to pay"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "LnPaymentRequestZeroAmountRequiredError":
      message = "Invoice must be a zero-amount invoice"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidPhoneNumberPhoneProviderError":
      message = "Phone number is not a valid phone number"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidTypePhoneProviderError":
      message = "Invalid phone number type. Please use a mobile number."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "MissingTypePhoneProviderError":
      message = "Issue checking phone number. Please try again later or contact support."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "RestrictedRegionPhoneProviderError":
      message = "Phone number is not from a valid region"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "PhoneProviderConnectionError":
    case "PhoneProviderUnavailableError":
      message = "Phone provider temporarily unreachable"
      return new PhoneProviderError({ message, logger: baseLogger })

    case "PhoneProviderRateLimitExceededError":
      message = "Too many phone number attempts, please try again in a few minutes."
      return new PhoneProviderError({ message, logger: baseLogger })

    case "UserCodeAttemptAppcheckJtiLimiterExceededError":
      message = "Too many attempts, please try again in a few minutes."
      return new PhoneProviderError({ message, logger: baseLogger })

    case "RestrictedRecipientPhoneNumberError":
      message =
        "Issue detected with phone number. Please try again later or contact support."
      return new PhoneProviderError({ message, logger: baseLogger })

    case "InvalidOrApprovedVerificationError":
      message =
        "Issue detected with verification. Please try again later or contact support."
      return new PhoneProviderError({ message, logger: baseLogger })

    case "UnsubscribedRecipientPhoneProviderError":
      message = "Phone number has opted out of receiving messages"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidContactAlias":
      message = "ContactAlias has incorrect characters or length"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvoiceCreateRateLimiterExceededError":
    case "InvoiceCreateForRecipientRateLimiterExceededError":
      message = "Too many invoices creation, please wait for a while and try again."
      return new TooManyRequestError({ message, logger: baseLogger })

    case "OnChainAddressCreateRateLimiterExceededError":
      message =
        "Too many onchain addresses creation, please wait for a while and try again."
      return new TooManyRequestError({ message, logger: baseLogger })

    case "DeviceAccountCreateRateLimiterExceededError":
      message = "Too many device account creation, please wait for a while and try again."
      return new TooManyRequestError({ message, logger: baseLogger })

    case "UserCodeAttemptIdentifierRateLimiterExceededError":
      message = "Too many request code attempts, please wait for a while and try again."
      return new TooManyRequestError({ message, logger: baseLogger })

    case "UserCodeAttemptIpRateLimiterExceededError":
      message =
        "Too many phone code attempts on same network, please wait for a while and try again."
      return new TooManyRequestError({ message, logger: baseLogger })

    case "CreateDeviceAccountIpRateLimiterExceededError":
      message =
        "Too many account creation attempts on same network, please wait for a while and try again."
      return new TooManyRequestError({ message, logger: baseLogger })

    case "PhoneCodeInvalidError":
      message = "Invalid or incorrect code entered."
      return new VerificationCodeError({ message, logger: baseLogger })

    case "EmailCodeInvalidError":
      message = "Invalid or incorrect code entered."
      return new VerificationCodeError({ message, logger: baseLogger })

    case "EmailCodeExpiredError":
      message = "Your code has expired."
      return new VerificationCodeError({ message, logger: baseLogger })

    case "ExpiredOrNonExistentPhoneNumberError":
      message = "Invalid or incorrect phone entered."
      return new VerificationCodeError({ message, logger: baseLogger })

    case "CouldNotFindAccountFromPhoneError":
      message = "Invalid or incorrect phone entered."
      return new VerificationCodeError({ message, logger: baseLogger })

    case "UserLoginIdentifierRateLimiterExceededError":
      message = "Too many login attempts, please wait for a while and try again."
      return new TooManyRequestError({ message, logger: baseLogger })

    case "EmailValidationSubmittedTooOftenError":
      message = "Too many attempts, please wait for a while and try again."
      return new TooManyRequestError({ message, logger: baseLogger })

    case "UserLoginIpRateLimiterExceededError":
      message =
        "Too many login attempts on same network, please wait for a while and try again."
      return new TooManyRequestError({ message, logger: baseLogger })

    case "AddQuizAttemptIpRateLimiterExceededError":
      message = "Too many attempts, please wait for a while and try again."
      return new TooManyRequestError({ message, logger: baseLogger })

    case "AddQuizAttemptPhoneRateLimiterExceededError":
      message = "Too many attempts, please wait for a while and try again."
      return new TooManyRequestError({ message, logger: baseLogger })

    case "InvalidQuizQuestionIdError":
      message = "Invalid quiz question id was passed."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidPushNotificationSettingError":
      message = "Invalid push notification setting was passed."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidNotificationCategoryError":
      message = error.message
      return new ValidationInternalError({ message, logger: baseLogger })

    case "QuizAlreadyPresentError":
      message = "Quiz question was already claimed."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "NotEnoughBalanceForQuizError":
      message =
        "Quiz wallet temporarily depleted. Please contact support if problem persists."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "SubOneCentSatAmountForUsdSelfSendError":
    case "SubOneCentSatAmountForUsdReceiveError":
      message = "Amount sent was too low for recipient's usd wallet."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidPhoneForQuizError":
      message = "Unsupported phone carrier for quiz."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidIpMetadataError":
      message = "Unsupported IP."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "NoConnectionToPriceServiceError":
      message = "Price unavailable, please wait for a while and try again."
      return new PriceServiceOfflineError({ message, logger: baseLogger })

    case "NoDealerPriceDataAvailableError":
      message = "No price data from dealer to perform USD operation."
      return new DealerError({ message, logger: baseLogger })

    case "NoConnectionToDealerError":
      message = "No connection to dealer to perform USD operation."
      return new DealerOfflineError({ message, logger: baseLogger })

    case "DealerStalePriceError":
      message = "Stale dealer price, can't perform USD operation."
      return new DealerOfflineError({ message, logger: baseLogger })

    case "RouteNotFoundError":
    case "MaxFeeTooLargeForRoutelessPaymentError":
      message = "Unable to find a route for payment."
      return new RouteFindingError({ message, logger: baseLogger })

    case "DestinationMissingDependentFeatureError":
      message = "Unable to pay incompatible recipient."
      return new RouteFindingError({ message, logger: baseLogger })

    case "UnknownNextPeerError":
      message = "Unable to find a route for payment."
      return new RouteFindingError({ message, logger: baseLogger })

    case "ProbeForRouteTimedOutError":
    case "ProbeForRouteTimedOutFromApplicationError":
      message = "Unable to find a route for payment."
      return new RouteFindingError({ message, logger: baseLogger })

    case "PaymentInTransitionError":
      message = "Payment was sent and is still in transition."
      return new LightningPaymentError({ message, logger: baseLogger })

    case "TemporaryChannelFailureError":
    case "TemporaryNodeFailureError":
      message = "Issue with lightning payment, please try again."
      return new LightningPaymentError({ message, logger: baseLogger })

    case "InvalidFeatureBitsForLndInvoiceError":
      message = "Invoice may have invalid feature bits set, please check again."
      return new LightningPaymentError({ message, logger: baseLogger })

    case "UsernameNotAvailableError":
      message = "username not available"
      return new UsernameError({ message, logger: baseLogger })

    case "UsernameIsImmutableError":
      message = "username is immutable"
      return new UsernameError({ message, logger: baseLogger })

    case "InvalidWalletId":
      message = "Invalid walletId for account."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidDisplayCurrencyError":
      message = "Invalid currency."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "MismatchedCurrencyForWalletError":
      message = "Unsupported operation for wallet's currency."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "DuplicateLedgerExternalIdError":
      message = `External id for invoice or transaction already exists`
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InsufficientBalanceError":
      message = error.message
      return new InsufficientBalanceError({ message, logger: baseLogger })

    case "CaptchaUserFailToPassError":
      message = "Captcha validation failed."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "AmountLessThanFeeError":
    case "LessThanDustThresholdError":
      message = error.message
      return new ValidationInternalError({ message, logger: baseLogger })

    case "OffChainServiceUnavailableError":
    case "OffChainServiceBusyError":
    case "OnChainServiceUnavailableError":
      /* eslint-disable-next-line no-case-declarations */
      const serviceType = errorName.includes("OffChainService") ? "Offchain" : "Onchain"
      message = `${serviceType} action failed, please try again in a few minutes. If the problem persists, please contact support. If you are on regtest, it might because blocks need to be generated so that lnd can be considered active.`
      return new LndOfflineError({ message, logger: baseLogger })

    case "InactiveAccountError":
      message = "Account is inactive."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidPriceCurrencyError":
      message = "Invalid currency."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidCoordinatesError":
      return new InvalidCoordinatesError({ logger: baseLogger })

    case "InvalidBusinessTitleLengthError":
      return new InvalidBusinessTitleLengthError({ logger: baseLogger })

    case "CannotConnectToDbError":
    case "DbConnectionClosedError":
      message =
        "Service offline, please try again in a few minutes. If the problem persists, please contact support."
      return new DbError({ message, logger: baseLogger })

    case "InvalidPaginationArgumentsError":
      message = "Invalid pagination arguments"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "AccountHasPositiveBalanceError":
      message =
        "The phone is associated with an existing wallet that has a non zero balance. Sweep the funds and try again."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "PhoneAccountAlreadyExistsError":
      message =
        "Phone Account already exists. Please logout and log back in with your phone account."
      return new PhoneAccountAlreadyExistsError({ message, logger: baseLogger })

    case "PhoneAccountAlreadyExistsNeedToSweepFundsError":
      message =
        "Error phone account already exists. You need to manually sweep funds to your phone account."
      return new PhoneAccountAlreadyExistsNeedToSweepFundsError({
        message,
        logger: baseLogger,
      })

    case "InvalidIdempotencyKeyError":
      message =
        "Invalid format for the provided ImpotencyKey. You must use a UUID-v4 format"
      return new ValidationInternalError({
        message,
        logger: baseLogger,
      })

    case "EmailUnverifiedError":
      return new EmailUnverifiedError({ logger: baseLogger })

    case "AccountAlreadyHasEmailError":
      return new AccountAlreadyHasEmailError({ logger: baseLogger })

    case "PhoneAlreadyExistsError":
      return new PhoneAlreadyExistsError({ logger: baseLogger })

    case "EmailAlreadyExistsError":
      return new EmailAlreadyExistsError({ logger: baseLogger })

    case "CodeExpiredKratosError":
      return new CodeExpiredError({ logger: baseLogger })

    case "SessionRefreshRequiredError":
      return new SessionRefreshRequiredError({ logger: baseLogger })

    case "UnauthorizedIPForOnboardingError":
      return new UnauthorizedIPForOnboardingError({ logger: baseLogger })

    case "InvalidPhoneMetadataForOnboardingError":
      return new InvalidPhoneMetadataForOnboardingError({ logger: baseLogger })

    case "InvalidPhoneForOnboardingError":
      return new InvalidPhoneForOnboardingError({ logger: baseLogger })

    case "UnauthorizedIPError":
      return new UnauthorizedIPError({ logger: baseLogger })

    case "UnauthorizedIPMetadataProxyError":
      return new UnauthorizedIPMetadataProxyError({ logger: baseLogger })

    case "UnauthorizedIPMetadataCountryError":
      return new UnauthorizedIPMetadataCountryError({ logger: baseLogger })

    case "InvalidPaginatedQueryArgsError":
      message = error.message
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidLedgerExternalId":
      message =
        "Invalid external id string passed. ID should be either alphanumeric " +
        "or contain the characters '_' or '-'. It should not be more than 100 " +
        "characters long as well."
      return new ValidationInternalError({ message, logger: baseLogger })

    case "ErrorFetchingLnurlInvoice":
      message = error.message
      return new LnurlRequestInvoiceError({ message, logger: baseLogger })

    case "LikelyBadCoreError":
      message = error.message
      return new LikelyBadCoreError({ message, logger: baseLogger })

    case "QuizClaimedTooEarlyError":
      message = error.message
      return new QuizClaimedTooEarlyError({ message, logger: baseLogger })

    case "InvoiceAlreadyProcessedError":
      message = "The invoice has already been processed"
      return new ValidationInternalError({ message, logger: baseLogger })

    case "InvalidAccountForDeletionError":
      message =
        "Unfortunately, we're unable to delete your account automatically at this time. Please reach out to our support team for assistance with the deletion process."
      return new OperationRestrictedError({ message, logger: baseLogger })

    case "InvalidInvoiceAmountError":
      message = "Invalid invoice amount"
      return new ValidationInternalError({ message, logger: baseLogger })

    // ----------
    // Unhandled below here
    // ----------
    case "RateLimiterExceededError":
    case "RateLimitError":
    case "RateLimitServiceError":
    case "CouldNotFindUserError":
    case "LedgerError":
    case "LedgerServiceError":
    case "LedgerFacadeError":
    case "LightningError":
    case "BadPaymentDataError":
    case "LnInvoiceDecodeError":
    case "LightningServiceError":
    case "CouldNotDecodeReturnedPaymentRequest":
    case "InvoiceNotFoundError":
    case "InvoiceAlreadySettledError":
    case "InvoiceNotPaidError":
    case "PaymentNotFoundError":
    case "OperationInterruptedError":
    case "InconsistentDataError":
    case "AuthorizationError":
    case "RepositoryError":
    case "PersistError":
    case "CouldNotFindError":
    case "CouldNotUpdateError":
    case "ValidationError":
    case "LnRouteValidationError":
    case "BadAmountForRouteError":
    case "InvalidUsername":
    case "InvalidDeviceId":
    case "InvalidIdentityPassword":
    case "InvalidIdentityUsername":
    case "InvalidPhoneNumber":
    case "InvalidTotpCode":
    case "InvalidEmailAddress":
    case "NoContactForUsernameError":
    case "NoWalletExistsForUserError":
    case "NoBtcWalletExistsForAccountError":
    case "LimitsExceededError":
    case "CouldNotFindLightningPaymentFlowError":
    case "NoExpiredLightningPaymentFlowsError":
    case "CouldNotUpdateLightningPaymentFlowError":
    case "CouldNotFindWalletFromIdError":
    case "CouldNotListWalletsFromAccountIdError":
    case "CouldNotFindWalletFromUsernameError":
    case "CouldNotFindWalletFromUsernameAndCurrencyError":
    case "CouldNotFindWalletFromAccountIdAndCurrencyError":
    case "CouldNotFindWalletFromOnChainAddressError":
    case "CouldNotFindWalletFromOnChainAddressesError":
    case "CouldNotFindBtcWalletForAccountError":
    case "CouldNotFindWalletOnChainPendingReceiveError":
    case "CouldNotFindLnPaymentFromHashError":
    case "LockError":
    case "LockServiceError":
    case "ResourceAttemptsRedlockServiceError":
    case "ResourceAttemptsTimelockServiceError":
    case "ResourceExpiredLockServiceError":
    case "PriceError":
    case "PriceServiceError":
    case "PriceNotAvailableError":
    case "CouldNotFindPriceCurrencyError":
    case "CouldNotFindCurrencyFromCountryError":
    case "DealerPriceNotAvailableError":
    case "PriceHistoryNotAvailableError":
    case "PriceCurrenciesNotAvailableError":
    case "OnChainError":
    case "TransactionDecodeError":
    case "OnChainServiceError":
    case "OnChainAddressAlreadyCreatedForRequestIdError":
    case "OnChainAddressNotFoundError":
    case "PayoutNotFoundError":
    case "PayoutDestinationBlocked":
    case "NotificationsError":
    case "NotificationsServiceError":
    case "InvalidDeviceNotificationsServiceError":
    case "ConcurrentModificationNotificationsServiceError":
    case "DeviceTokensNotRegisteredNotificationsServiceError":
    case "AccountError":
    case "IpFetcherError":
    case "IpFetcherServiceError":
    case "CouldNotFindTransactionError":
    case "CouldNotFindTransactionMetadataError":
    case "CouldNotFindExpectedTransactionMetadataError":
    case "InvalidDocumentIdForDbError":
    case "DuplicateKeyForPersistError":
    case "MismatchedResultForTransactionMetadataQuery":
    case "InvalidLedgerTransactionId":
    case "MultiplePendingPaymentsForHashError":
    case "MissingExpectedDisplayAmountsForTransactionError":
    case "InvalidLnPaymentTxnsBundleError":
    case "InvalidTxMetadataFetchedError":
    case "CacheError":
    case "CacheNotAvailableError":
    case "CacheServiceError":
    case "CacheUndefinedError":
    case "PhoneProviderServiceError":
    case "ExpectedPhoneMetadataMissingError":
    case "PhoneCarrierTypeNotAllowedError":
    case "PhoneCountryNotAllowedError":
    case "MissingIPMetadataError":
    case "UnauthorizedIPMetadataASNError":
    case "InvalidAccountStatusError":
    case "InvalidOnChainAddress":
    case "InvalidScanDepthAmount":
    case "InsufficientBalanceForRoutingError":
    case "InsufficientBalanceForLnPaymentError":
    case "InvalidLanguageError":
    case "InvalidAccountLevelError":
    case "InvalidAccountLimitTypeError":
    case "InvalidWithdrawFeeError":
    case "InvalidUsdCents":
    case "NonIntegerError":
    case "FeeDifferenceError":
    case "NoTransactionToSettleError":
    case "NoTransactionToUpdateStateError":
    case "CorruptLndDbError":
    case "NotImplementedError":
    case "NotReachableError":
    case "DealerPriceError":
    case "DealerPriceServiceError":
    case "InvalidNegativeAmountError":
    case "DomainError":
    case "ErrorLevel":
    case "RankedErrorLevel":
    case "InvalidCurrencyBaseAmountError":
    case "NoTransactionToUpdateError":
    case "BalanceLessThanZeroError":
    case "CouldNotFindAccountFromKratosIdError":
    case "MissingPhoneError":
    case "InvalidUserId":
    case "InvalidLightningPaymentFlowBuilderStateError":
    case "InvalidOnChainPaymentFlowBuilderStateError":
    case "InvalidWalletInvoiceBuilderStateError":
    case "NonLnPaymentTransactionForPaymentFlowError":
    case "MissingPropsInTransactionForPaymentFlowError":
    case "InvalidZeroAmountPriceRatioInputError":
    case "InvalidCurrencyForWalletError":
    case "InvalidLightningPaymentFlowStateError":
    case "InvalidLedgerTransactionStateError":
    case "BadInputsForFindError":
    case "LnHashPresentInIntraLedgerFlowError":
    case "IntraLedgerHashPresentInLnFlowError":
    case "PubSubError":
    case "PubSubServiceError":
    case "BigIntConversionError":
    case "BigIntFloatConversionError":
    case "SafeWrapperError":
    case "InvalidFeeProbeStateError":
    case "LookupPaymentTimedOutError":
    case "InvalidPubKeyError":
    case "SkipProbeForPubkeyError":
    case "SecretDoesNotMatchAnyExistingHodlInvoiceError":
    case "CaptchaError":
    case "InvalidNonHodlInvoiceError":
    case "InvalidAccountError":
    case "InvalidAccountIdError":
    case "InvalidMinutesError":
    case "InvalidWalletForAccountError":
    case "AuthenticationError":
    case "LikelyNoUserWithThisPhoneExistError":
    case "LikelyUserAlreadyExistError":
    case "CouldNotUnsetPhoneFromUserError":
    case "InvalidDeviceTokenError":
    case "EventAugmentationMissingError":
    case "NoPayloadFoundError":
    case "ExpectedUtxoDetectedPayloadNotFoundError":
    case "ExpectedUtxoDroppedPayloadNotFoundError":
    case "ExpectedUtxoSettledPayloadNotFoundError":
    case "ExpectedPayoutSubmittedPayloadNotFoundError":
    case "ExpectedPayoutCommittedPayloadNotFoundError":
    case "ExpectedPayoutBroadcastPayloadNotFoundError":
    case "ExpectedPayoutSettledPayloadNotFoundError":
    case "ExpectedPayoutCancelledPayloadNotFoundError":
    case "UnknownPayloadTypeReceivedError":
    case "ExpectedAddressInfoMissingInEventError":
    case "MissingCreatedAtKratosError":
    case "MissingExpiredAtKratosError":
    case "LnurlServiceError":
    case "InvalidIdentitySessionKratosError":
    case "MissingTotpKratosError":
    case "IncompatibleSchemaUpgradeError":
    case "UnknownKratosError":
    case "BriaEventError":
    case "BriaPayloadError":
    case "KratosError":
    case "AuthenticationKratosError":
    case "ExtendSessionKratosError":
    case "MultipleCurrenciesForSingleCurrencyOperationError":
    case "MattermostError":
    case "CouldNotFindAccountIpError":
    case "InvalidFlowId":
    case "CallbackError":
    case "InvalidUrlError":
    case "SvixEventError":
    case "UnknownSvixError":
    case "UnauthorizedPhoneError":
    case "PhoneMetadataValidationError":
    case "InvalidCarrierForPhoneMetadataError":
    case "InvalidCarrierTypeForPhoneMetadataError":
    case "InvalidErrorCodeForPhoneMetadataError":
    case "InvalidCountryCodeForPhoneMetadataError":
    case "MultipleWalletsFoundForAccountIdAndCurrency":
      message = `Unexpected error occurred, please try again or contact support if it persists (code: ${
        error.name
      }${error.message ? ": " + error.message : ""})`
      return new UnexpectedClientError({ message, logger: baseLogger })

    case "NotificationsServiceUnreachableServerError":
      message = `Unexpected error occurred, please try again or contact support if it persists (code: ${error.name})`
      return new UnexpectedClientError({ message, logger: baseLogger })

    case "MissingSessionIdError":
    case "AuthTokenUserIdMismatchError":
      return new UnexpectedClientError({
        message,
        logger: baseLogger,
        forwardToClient: false,
      })
    case "InvalidNotificationBodyError":
      message = error.message
      return new ValidationInternalError({ message, logger: baseLogger })
    case "InvalidNotificationTitleError":
      message = error.message
      return new ValidationInternalError({ message, logger: baseLogger })
    case "DuplicateLocalizedNotificationContentError":
      message = "Multiple localized push contents with the same language"
      return new ValidationInternalError({ message, logger: baseLogger })

    // ----------
    // Unknown below here
    // ----------
    case "UnknownRouteNotFoundError":
      message = "Unknown error occurred when trying to find a route for payment."
      return new RouteFindingError({ message, logger: baseLogger })

    case "UnknownLnInvoiceDecodeError":
      message = "Invalid lightning request, couldn't decode."
      return new InvoiceDecodeError({ message, logger: baseLogger })

    case "UnknownRepositoryError":
    case "UnknownLedgerError":
      message = `Unknown error occurred (code: ${error.name})`
      return new DbError({ message, logger: baseLogger, level: "fatal" })

    case "UnknownLightningServiceError":
      message = `Unknown error occurred (code: ${error.name})`
      return new LightningPaymentError({ message, logger: baseLogger })

    case "UnknownRateLimitServiceError":
    case "UnknownLockServiceError":
    case "UnknownPriceServiceError":
    case "UnknownOnChainServiceError":
    case "UnknownNotificationsServiceError":
    case "UnknownIpFetcherServiceError":
    case "UnknownLnurlServiceError":
    case "UnknownCacheServiceError":
    case "UnknownPhoneProviderServiceError":
    case "UnknownDealerPriceServiceError":
    case "UnknownPubSubError":
    case "UnknownBigIntConversionError":
    case "UnknownDomainError":
    case "UnknownBriaEventError":
    case "CouldNotFindAccountError":
    case "OathkeeperError":
    case "OathkeeperUnauthorizedServiceError":
    case "OathkeeperMissingAuthorizationHeaderError":
    case "OathkeeperForbiddenServiceError":
    case "UnknownOathkeeperServiceError":
    case "ChatAssistantError":
    case "SupportError":
    case "UnknownChatAssistantError":
    case "UnknownSupportError":
    case "UnknownPineconeError":
    case "CallbackServiceError":
    case "ChatAssistantNotFoundError":
    case "TimeoutAssistantError":
      message = `Unknown error occurred (code: ${error.name})`
      return new UnknownClientError({ message, logger: baseLogger })

    case "UnknownCaptchaError":
      message = `Unknown error occurred (code: ${error.name}${
        error.message ? ": " + error.message : ""
      })`
      return new UnknownClientError({ message, logger: baseLogger })
    default:
      return assertUnreachable(errorName)
  }
}

export const mapAndParseErrorForGqlResponse = (err: ApplicationError): IError => {
  const mappedError = mapError(err)
  return {
    message: mappedError.message,
    path: mappedError.path,
    code: `${mappedError.extensions.code}`,
  }
}
