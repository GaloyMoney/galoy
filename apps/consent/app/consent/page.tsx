import { redirect } from "next/navigation";
import React from "react";
import { hydraClient } from "../hydra-config";
import { oidcConformityMaybeFakeSession } from "../oidc-cert";
import MainContent from "../components/main-container";
import Card from "../components/card";
import Logo from "../components/logo";
import ScopeItem from "../components/scope-item/scope-item";
import ButtonComponent from "../components/button-component";
import { cookies } from "next/headers";

interface ConsentProps {
  consent_challenge: string;
}

const submitForm = async (form: FormData) => {
  "use server";
  const consent_challenge = form.get("consent_challenge");
  const submitValue = form.get("submit");
  const email = form.get("email");
  const remember = form.get("remember") === "1";
  const grantScope = form
    .getAll("grant_scope")
    .map((value) => value.toString());

  if (
    !consent_challenge ||
    !email ||
    typeof consent_challenge !== "string" ||
    typeof email !== "string"
  ) {
    console.error("INVALID PARAMS");
    return;
  }

  if (submitValue === "Deny access") {
    console.log("User denied access");
    let response;
    response = await hydraClient.rejectOAuth2ConsentRequest({
      consentChallenge: consent_challenge,
      rejectOAuth2Request: {
        error: "access_denied",
        error_description: "The resource owner denied the request",
      },
    });
    redirect(response.data.redirect_to);
  }

  let responseConfirm;
  let session = {
    // need more context on this
    access_token: { card: "alice", email },
    id_token: { card: "bob", email },
  };

  const responseInit = await hydraClient.getOAuth2ConsentRequest({
    consentChallenge: consent_challenge,
  });

  const body = responseInit.data;
  responseConfirm = await hydraClient.acceptOAuth2ConsentRequest({
    consentChallenge: consent_challenge,
    acceptOAuth2ConsentRequest: {
      grant_scope: grantScope,
      session: oidcConformityMaybeFakeSession(grantScope, body, session),
      grant_access_token_audience: body.requested_access_token_audience,
      remember: remember,
      remember_for: 3600,
    },
  });
  redirect(responseConfirm.data.redirect_to);
};

const Consent = async ({ searchParams }: { searchParams: ConsentProps }) => {
  const { consent_challenge } = searchParams;

  if (!consent_challenge) {
    throw new Error("Invalid Request");
  }

  const data = await hydraClient.getOAuth2ConsentRequest({
    consentChallenge: consent_challenge,
  });

  const body = data.data;
  const login_challenge = data.data.login_challenge;

  if (!login_challenge) {
    throw new Error("Login Challenge Not Found");
  }

  const cookieStore = cookies().get(login_challenge);

  if (!cookieStore) {
    throw new Error("Cannot find cookies");
  }

  const { email } = JSON.parse(cookieStore.value);

  if (!email) {
    throw new Error("Email Not Found");
  }

  if (body.client?.skip_consent) {
    let response;
    response = await hydraClient.acceptOAuth2ConsentRequest({
      consentChallenge: consent_challenge,
      acceptOAuth2ConsentRequest: {
        grant_scope: body.requested_scope,
        grant_access_token_audience: body.requested_access_token_audience,
        session: {
          //  need more context on this
          access_token: { card: "alice", email },
          id_token: { who: "bob", email },
        },
      },
    });
    redirect(String(response.data.redirect_to));
  }

  const user = body.subject;
  const { client, requested_scope } = body;

  if (!user || !client || !requested_scope) {
    return <p>INTERNAL SERVER ERROR</p>;
  }

  return (
    <MainContent>
      <Card>
        <Logo />

        <div className="flex items-center justify-center">
          <p className="text-center mb-4 text-xl w-60 font-semibold">
            An application requests access to your data!
          </p>
        </div>

        <form action={submitForm} className="flex flex-col">
          <input type="hidden" name="email" value={email} />
          <input
            type="hidden"
            name="consent_challenge"
            value={consent_challenge}
          />

          <p className="mb-4 text-gray-700 text-center  font-semibold">
            Hi {user}{" "}
          </p>
          <p className="mb-4 text-gray-700 ">
            Application{" "}
            <strong>{client.client_name || client.client_id}</strong> wants
            access resources on your behalf and to:
          </p>

          {requested_scope.map((scope) => (
            <ScopeItem scope={scope} key={scope} />
          ))}

          <p className="mb-4 text-gray-700">
            Do you want to be asked next time when this application wants to
            access your data?
          </p>
          <p className="mb-4 text-gray-700">
            The application will not be able to ask for more permissions without
            your consent.
          </p>
          <ul className="mb-4">
            {client.policy_uri && (
              <li className="mb-2">
                <a
                  href={client.policy_uri}
                  className="text-blue-500 hover:underline"
                >
                  Policy
                </a>
              </li>
            )}
            {client.tos_uri && (
              <li className="mb-2">
                <a
                  href={client.tos_uri}
                  className="text-blue-500 hover:underline"
                >
                  Terms of Service
                </a>
              </li>
            )}
          </ul>
          <p className="flex items-center mb-4">
            <input
              type="checkbox"
              id="remember"
              name="remember"
              value="1"
              className="mr-2"
            />
            <label htmlFor="remember" className="text-gray-700">
              Do not ask me again
            </label>
          </p>
          <div className="flex flex-col md:flex-row w-full gap-2">
            <button
              type="submit"
              id="reject"
              name="submit"
              value="Deny access"
              className="flex-1 bg-red-500 text-white  p-2 rounded-lg hover:bg-red-700 mb-2 md:mb-0"
            >
              Deny
            </button>

            <ButtonComponent
              type="submit"
              id="accept"
              name="submit"
              value="Allow access"
              className="flex-1 bg-blue-500 text-white  p-2 rounded-lg hover:bg-blue-700"
            >
              Allow
            </ButtonComponent>
          </div>
        </form>
      </Card>
    </MainContent>
  );
};
export default Consent;
