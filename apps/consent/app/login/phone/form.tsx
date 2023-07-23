"use client";
import React, { useState } from "react";
import InputComponent from "@/app/components/input-component";
import PrimaryButton from "@/app/components/button/primary-button-component";
import SecondaryButton from "@/app/components/button/secondary-button-component";
import Link from "next/link";
import { CaptchaChallenge } from "@/app/components/captcha-challenge";
import { getCaptchaChallenge } from "./server-actions";
import { toast } from "react-toastify";
import FormComponent from "@/app/components/form-component";
import Separator from "@/app/components/separator";
// @ts-ignore-next-line no-implicit-any error
import { experimental_useFormState as useFormState } from "react-dom";
import { GetCaptchaChallengeResponse } from "./phone-login.types";
import { AuthChannels } from "@/app/graphql/queries/get-supported-countries";
import PhoneInput from "react-phone-number-input";

interface LoginFormProps {
  login_challenge: string;
  countryCodes: any;
}

// TODO need to add country call codes
const LoginForm: React.FC<LoginFormProps> = ({
  login_challenge,
  countryCodes,
}) => {
  //TODO useFormState is not giving type suggestions/errors i.e: not typed
  const [state, formAction] = useFormState<GetCaptchaChallengeResponse>(
    getCaptchaChallenge,
    {
      error: null,
      message: null,
      responsePayload: {
        id: null,
        challenge: null,
        formData: {
          login_challenge: null,
          phone: null,
          remember: null,
        },
      },
    }
  );

  if (state.error) {
    toast.error(state.message);
  }

  return (
    <>
      {state.message === "success" ? (
        <CaptchaChallenge
          id={state.responsePayload.id}
          challenge={state.responsePayload.challenge}
          formData={state.responsePayload.formData}
        />
      ) : null}
      <FormComponent action={formAction}>
        <input type="hidden" name="login_challenge" value={login_challenge} />
        <InputComponent
          data-testid="phone_number_input"
          label="Phone"
          type="tel"
          id="phone"
          name="phone"
          required
          placeholder="Phone Number"
        />
        <div className="flex items-center mb-4">
          <label className="text-gray-700 text-sm flex items-center">
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
        <Separator>or</Separator>

        <div className="flex justify-center mb-4">
          <div className="text-center text-sm w-60">
            <Link href={`/login?login_challenge=${login_challenge}`} replace>
              <p className="font-semibold text-sm">Sign in with Email</p>
            </Link>
          </div>
        </div>

        <div className="flex flex-col md:flex-row w-full gap-2">
          <SecondaryButton
            type="button"
            id="reject"
            name="submit"
            value="Deny access"
          >
            Cancel
          </SecondaryButton>
          <PrimaryButton
            data-testid="phone_login_next_btn"
            type="submit"
            id="accept"
            name="submit"
            value="Log in"
            className="flex-1 bg-blue-500 text-white p-2 rounded-lg hover:bg-blue-700"
          >
            Next
          </PrimaryButton>
        </div>
      </FormComponent>
    </>
  );
};

export default LoginForm;
