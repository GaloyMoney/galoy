"use client"
import React from "react"

import { useFormState } from "react-dom"
import { useRouter } from "next/navigation"
import { toast } from "react-toastify"

import InputComponent from "../../components/input-component"
import FormComponent from "../../components/form-component"
import Separator from "../../components/separator"
import PrimaryButton from "../../components/button/primary-button-component"
import SecondaryButton from "../../components/button/secondary-button-component"
import RegisterLink from "../../components/register-link"

import { SubmitValue } from "../types/index.types"

import { submitForm } from "./email-login-server-action"
import { LoginEmailResponse } from "./email-login.types"

import SignInTab from "@/components/tab/sign-in-tabs"

interface LoginProps {
  login_challenge: string
}

const EmailLoginForm = ({ login_challenge }: LoginProps) => {
  const router = useRouter()

  const [state, formAction] = useFormState<LoginEmailResponse, FormData>(submitForm, {
    error: false,
    message: null,
    responsePayload: null,
  })

  if (state.error) {
    toast.error(state.message)
    state.error = false
    state.message = null
    state.responsePayload = null
  }

  return (
    <>
      <FormComponent action={formAction}>
        <input type="hidden" name="login_challenge" value={login_challenge} />
        <SignInTab login_challenge={login_challenge} />
        <InputComponent
          data-testid="email_id_input"
          type="email"
          id="email"
          name="email"
          required
          placeholder="Email"
        />
        <div className="flex items-center mb-4">
          <label className="text-[var(--inputColor)] text-sm flex items-center">
            <input
              type="checkbox"
              id="remember"
              name="remember"
              value="1"
              className="mr-2"
              style={{ width: "14px", height: "14px" }}
            />
            Remember me
          </label>
        </div>
        <div className="flex flex-col md:flex-row-reverse w-full gap-2 mb-6">
          <PrimaryButton
            type="submit"
            id="accept"
            name="submit"
            value="Log in"
            data-testid="email_login_next_btn"
          >
            Next
          </PrimaryButton>
          <SecondaryButton
            type="button"
            id="reject"
            name="cancel"
            value={SubmitValue.denyAccess}
            formNoValidate
            onClick={() => router.back()}
          >
            Cancel
          </SecondaryButton>
        </div>
        <Separator>or</Separator>
        <div className="m-2">
          <RegisterLink href={`/register?login_challenge=${login_challenge}`} />
        </div>
      </FormComponent>
    </>
  )
}
export default EmailLoginForm
