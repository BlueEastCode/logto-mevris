import crypto from 'node:crypto';

import { PasswordPolicyChecker } from '@logto/core-kit';
import { InteractionEvent, MfaFactor, MfaPolicy } from '@logto/schemas';
import { createMockUtils } from '@logto/shared/esm';
import type Provider from 'oidc-provider';

import { mockBackupCodeBind, mockTotpBind } from '#src/__mocks__/mfa-verification.js';
import { mockSignInExperience } from '#src/__mocks__/sign-in-experience.js';
import { mockUser, mockUserWithMfaVerifications } from '#src/__mocks__/user.js';
import RequestError from '#src/errors/RequestError/index.js';
import { createMockProvider } from '#src/test-utils/oidc-provider.js';
import { MockTenant } from '#src/test-utils/tenant.js';
import { createContextWithRouteParameters } from '#src/utils/test-utils.js';

import type {
  AccountVerifiedInteractionResult,
  IdentifierVerifiedInteractionResult,
} from '../types/index.js';

const { jest } = import.meta;
const { mockEsmWithActual } = createMockUtils(jest);

const findUserById = jest.fn();

const tenantContext = new MockTenant(undefined, {
  users: {
    findUserById,
  },
});

const mockBackupCodes = ['foo'];
await mockEsmWithActual('../utils/backup-code-validation.js', () => ({
  generateBackupCodes: jest.fn().mockReturnValue(mockBackupCodes),
}));

const { storeInteractionResult } = await mockEsmWithActual('../utils/interaction.js', () => ({
  storeInteractionResult: jest.fn(),
}));

const { validateMandatoryBindMfa, verifyBindMfa, verifyMfa, validateBindMfaBackupCode } =
  await import('./mfa-verification.js');

const baseCtx = {
  ...createContextWithRouteParameters(),
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  interactionDetails: {} as Awaited<ReturnType<Provider['interactionDetails']>>,
  signInExperience: {
    ...mockSignInExperience,
    mfa: {
      factors: [],
      policy: MfaPolicy.UserControlled,
    },
  },
  passwordPolicyChecker: new PasswordPolicyChecker(
    mockSignInExperience.passwordPolicy,
    crypto.subtle
  ),
};

const mfaRequiredCtx = {
  ...baseCtx,
  signInExperience: {
    ...mockSignInExperience,
    mfa: {
      factors: [MfaFactor.TOTP, MfaFactor.WebAuthn],
      policy: MfaPolicy.Mandatory,
    },
  },
};

const backupCodeEnabledCtx = {
  ...baseCtx,
  signInExperience: {
    ...mockSignInExperience,
    mfa: {
      factors: [MfaFactor.TOTP, MfaFactor.WebAuthn, MfaFactor.BackupCode],
      policy: MfaPolicy.Mandatory,
    },
  },
};

const interaction: IdentifierVerifiedInteractionResult = {
  event: InteractionEvent.Register,
  identifiers: [{ key: 'accountId', value: 'foo' }],
};

const signInInteraction: AccountVerifiedInteractionResult = {
  event: InteractionEvent.SignIn,
  identifiers: [{ key: 'accountId', value: 'foo' }],
  accountId: 'foo',
};

const provider = createMockProvider();

describe('validateMandatoryBindMfa', () => {
  afterEach(() => {
    findUserById.mockReset();
  });

  describe('register', () => {
    it('bindMfa missing but required should throw', async () => {
      await expect(
        validateMandatoryBindMfa(tenantContext, mfaRequiredCtx, interaction)
      ).rejects.toMatchError(
        new RequestError(
          {
            code: 'user.missing_mfa',
            status: 422,
          },
          { availableFactors: [MfaFactor.TOTP, MfaFactor.WebAuthn] }
        )
      );
    });

    it('bindMfas exists should pass', async () => {
      await expect(
        validateMandatoryBindMfa(tenantContext, mfaRequiredCtx, {
          ...interaction,
          bindMfas: [
            {
              type: MfaFactor.TOTP,
              secret: 'foo',
            },
          ],
        })
      ).resolves.not.toThrow();
    });

    it('bindMfa missing and not required should pass', async () => {
      await expect(
        validateMandatoryBindMfa(tenantContext, baseCtx, interaction)
      ).resolves.not.toThrow();
    });
  });

  describe('signIn', () => {
    it('user mfaVerifications and bindMfa missing but required should throw', async () => {
      findUserById.mockResolvedValueOnce(mockUser);
      await expect(
        validateMandatoryBindMfa(tenantContext, mfaRequiredCtx, signInInteraction)
      ).rejects.toMatchError(
        new RequestError(
          {
            code: 'user.missing_mfa',
            status: 422,
          },
          { availableFactors: [MfaFactor.TOTP, MfaFactor.WebAuthn] }
        )
      );
    });

    it('user mfaVerifications and bindMfa missing and not required should pass', async () => {
      findUserById.mockResolvedValueOnce(mockUser);
      await expect(
        validateMandatoryBindMfa(tenantContext, baseCtx, signInInteraction)
      ).resolves.not.toThrow();
    });

    it('user mfaVerifications missing, bindMfas existing and required should pass', async () => {
      findUserById.mockResolvedValueOnce(mockUser);
      await expect(
        validateMandatoryBindMfa(tenantContext, mfaRequiredCtx, {
          ...signInInteraction,
          bindMfas: [
            {
              type: MfaFactor.TOTP,
              secret: 'foo',
            },
          ],
        })
      ).resolves.not.toThrow();
    });

    it('user mfaVerifications existing, bindMfa missing and required should pass', async () => {
      findUserById.mockResolvedValueOnce(mockUserWithMfaVerifications);
      await expect(
        validateMandatoryBindMfa(tenantContext, baseCtx, signInInteraction)
      ).resolves.not.toThrow();
    });
  });
});

describe('verifyBindMfa', () => {
  it('should pass if bindMfa is missing', async () => {
    await expect(verifyBindMfa(tenantContext, signInInteraction)).resolves.not.toThrow();
  });

  it('should pass if event is not sign in', async () => {
    await expect(
      verifyBindMfa(tenantContext, {
        ...interaction,
        bindMfas: [
          {
            type: MfaFactor.TOTP,
            secret: 'foo',
          },
        ],
      })
    ).resolves.not.toThrow();
  });

  it('pass if the user has no TOTP factor', async () => {
    findUserById.mockResolvedValueOnce(mockUser);
    await expect(
      verifyBindMfa(tenantContext, {
        ...signInInteraction,
        bindMfas: [
          {
            type: MfaFactor.TOTP,
            secret: 'foo',
          },
        ],
      })
    ).resolves.not.toThrow();
  });

  it('should reject if the user already has a TOTP factor', async () => {
    findUserById.mockResolvedValueOnce(mockUserWithMfaVerifications);
    await expect(
      verifyBindMfa(tenantContext, {
        ...signInInteraction,
        bindMfas: [
          {
            type: MfaFactor.TOTP,
            secret: 'foo',
          },
        ],
      })
    ).rejects.toMatchError(new RequestError({ code: 'user.totp_already_in_use', status: 422 }));
  });
});

describe('verifyMfa', () => {
  it('should pass if user mfaVerifications is empty', async () => {
    findUserById.mockResolvedValueOnce(mockUser);
    await expect(verifyMfa(tenantContext, signInInteraction)).resolves.not.toThrow();
  });

  it('should pass if verifiedMfa exists', async () => {
    findUserById.mockResolvedValueOnce(mockUserWithMfaVerifications);
    await expect(
      verifyMfa(tenantContext, {
        ...signInInteraction,
        verifiedMfa: {
          type: MfaFactor.TOTP,
          id: 'id',
        },
      })
    ).resolves.not.toThrow();
  });

  it('should reject if verifiedMfa can not be found', async () => {
    findUserById.mockResolvedValueOnce(mockUserWithMfaVerifications);
    await expect(
      verifyMfa(tenantContext, {
        ...signInInteraction,
        verifiedMfa: undefined,
      })
    ).rejects.toThrowError();
  });
});

describe('validateBindMfaBackupCode', () => {
  it('should pass if bindMfas is empty', async () => {
    await expect(
      validateBindMfaBackupCode(tenantContext, baseCtx, signInInteraction, provider)
    ).resolves.not.toThrow();
  });

  it('should pass if backup code is not enabled', async () => {
    await expect(
      validateBindMfaBackupCode(
        tenantContext,
        mfaRequiredCtx,
        {
          ...signInInteraction,
          bindMfas: [mockTotpBind],
        },
        provider
      )
    ).resolves.not.toThrow();
  });

  it('should pass if backup code is set', async () => {
    await expect(
      validateBindMfaBackupCode(
        tenantContext,
        backupCodeEnabledCtx,
        {
          ...signInInteraction,
          bindMfas: [mockTotpBind, mockBackupCodeBind],
        },
        provider
      )
    ).resolves.not.toThrow();
  });

  it('should reject if backup code is not set', async () => {
    findUserById.mockResolvedValueOnce(mockUserWithMfaVerifications);

    await expect(
      validateBindMfaBackupCode(
        tenantContext,
        backupCodeEnabledCtx,
        {
          ...signInInteraction,
          bindMfas: [mockTotpBind],
        },
        provider
      )
    ).rejects.toThrowError(
      new RequestError(
        { code: 'session.mfa.backup_code_required', status: 422 },
        { codes: mockBackupCodes }
      )
    );

    expect(storeInteractionResult).toHaveBeenCalledWith(
      {
        pendingMfa: { type: MfaFactor.BackupCode, codes: mockBackupCodes },
      },
      expect.anything(),
      expect.anything(),
      expect.anything()
    );
  });
});