import mongoose from "mongoose"

import { PaymentStatus } from "@/domain/bitcoin/lightning"

const Schema = mongoose.Schema

const confirmedDetailsSchema = new Schema<LnPaymentConfirmedDetails>({
  confirmedAt: {
    type: Date,
    required: true,
  },
  destination: {
    type: String,
    required: true,
  },
  revealedPreImage: {
    type: String,
    required: true,
  },
  roundedUpFee: {
    type: Number,
    required: true,
  },
  milliSatsFee: {
    type: Number,
    required: true,
  },
  hopPubkeys: [String],
})

const paymentAttemptSchema = Schema.Types.Mixed

const paymentSchema = new Schema<LnPaymentType>({
  createdAt: {
    type: Date,
    default: Date.now,
  },
  status: {
    type: String,
    enum: Object.values(PaymentStatus),
    required: true,
  },
  paymentHash: {
    type: String,
    index: true,
    unique: true,
    required: true,
  },
  paymentRequest: String,
  sentFromPubkey: {
    type: String,
  },
  milliSatsAmount: Number,
  roundedUpAmount: Number,
  confirmedDetails: confirmedDetailsSchema,
  attempts: [paymentAttemptSchema],
  isCompleteRecord: {
    type: Boolean,
    default: false,
  },
})

export const LnPayment = mongoose.model("LnPayment", paymentSchema)
