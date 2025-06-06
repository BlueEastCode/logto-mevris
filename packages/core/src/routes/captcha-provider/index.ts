import { CaptchaProviders, captchaConfigGuard } from '@logto/schemas';
import { z } from 'zod';

import koaGuard from '#src/middleware/koa-guard.js';
import { koaQuotaGuard } from '#src/middleware/koa-quota-guard.js';

import RequestError from '../../errors/RequestError/index.js';
import assertThat from '../../utils/assert-that.js';
import type { ManagementApiRouter, RouterInitArgs } from '../types.js';

export default function captchaProviderRoutes<T extends ManagementApiRouter>(
  ...args: RouterInitArgs<T>
) {
  const [router, { queries, libraries }] = args;
  const { findCaptchaProvider, upsertCaptchaProvider, deleteCaptchaProvider } =
    queries.captchaProviders;
  const { updateDefaultSignInExperience } = queries.signInExperiences;
  router.get(
    '/captcha-provider',
    koaGuard({
      response: CaptchaProviders.guard,
      status: [200, 404],
    }),
    async (ctx, next) => {
      const provider = await findCaptchaProvider();

      assertThat(
        provider,
        new RequestError({
          status: 404,
          code: 'entity.not_found',
        })
      );

      ctx.body = provider;
      return next();
    }
  );

  router.put(
    '/captcha-provider',
    koaGuard({
      body: z.object({
        config: captchaConfigGuard,
      }),
      response: CaptchaProviders.guard,
      status: [200],
    }),
    koaQuotaGuard({ key: 'securityFeaturesEnabled', quota: libraries.quota }),
    async (ctx, next) => {
      const { config } = ctx.guard.body;
      ctx.body = await upsertCaptchaProvider({
        config,
      });

      return next();
    }
  );

  router.delete(
    '/captcha-provider',
    koaGuard({
      status: [204, 404],
    }),
    async (ctx, next) => {
      await deleteCaptchaProvider();

      // Disable in sign in experience
      await updateDefaultSignInExperience({
        captchaPolicy: {
          enabled: false,
        },
      });
      ctx.status = 204;

      return next();
    }
  );
}
