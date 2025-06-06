import {
  InteractionEvent,
  SignInIdentifier,
  type PasswordVerificationPayload,
} from '@logto/schemas';
import { useCallback, useMemo, useState, useContext } from 'react';

import CaptchaContext from '@/Providers/CaptchaContextProvider/CaptchaContext';
import { signInWithPasswordIdentifier } from '@/apis/experience';
import useApi from '@/hooks/use-api';
import useCheckSingleSignOn from '@/hooks/use-check-single-sign-on';
import type { ErrorHandlers } from '@/hooks/use-error-handler';
import useErrorHandler from '@/hooks/use-error-handler';

import useGlobalRedirectTo from './use-global-redirect-to';
import useSubmitInteractionErrorHandler from './use-submit-interaction-error-handler';

const usePasswordSignIn = () => {
  const [errorMessage, setErrorMessage] = useState<string>();
  const { onSubmit: checkSingleSignOn } = useCheckSingleSignOn();
  const redirectTo = useGlobalRedirectTo();
  const { executeCaptcha } = useContext(CaptchaContext);

  const clearErrorMessage = useCallback(() => {
    setErrorMessage('');
  }, []);

  const handleError = useErrorHandler();
  const asyncSignIn = useApi(signInWithPasswordIdentifier);
  const preSignInErrorHandler = useSubmitInteractionErrorHandler(InteractionEvent.SignIn);

  const errorHandlers: ErrorHandlers = useMemo(
    () => ({
      'session.invalid_credentials': (error) => {
        setErrorMessage(error.message);
      },
      ...preSignInErrorHandler,
    }),
    [preSignInErrorHandler]
  );

  const onSubmit = useCallback(
    async (payload: PasswordVerificationPayload) => {
      const { identifier } = payload;
      const captchaToken = await executeCaptcha();

      // Check if the email is registered with any SSO connectors. If the email is registered with any SSO connectors, we should not proceed to the next step
      if (identifier.type === SignInIdentifier.Email) {
        const result = await checkSingleSignOn(identifier.value);

        if (result) {
          return;
        }
      }

      const [error, result] = await asyncSignIn(payload, captchaToken);

      if (error) {
        await handleError(error, errorHandlers);

        return;
      }

      if (result?.redirectTo) {
        await redirectTo(result.redirectTo);
      }
    },
    [asyncSignIn, checkSingleSignOn, errorHandlers, handleError, redirectTo]
  );

  return {
    errorMessage,
    clearErrorMessage,
    onSubmit,
  };
};

export default usePasswordSignIn;
