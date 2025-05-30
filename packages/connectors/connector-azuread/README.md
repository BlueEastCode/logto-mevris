# Microsoft Azure AD connector

The Microsoft Azure AD connector provides a succinct way for your application to use Azure’s OAuth 2.0 authentication system.

**Table of contents**

- [Microsoft Azure AD connector](#microsoft-azure-ad-connector)
  - [Set up Microsoft Azure AD in the Azure Portal](#set-up-microsoft-azure-ad-in-the-azure-portal)
  - [Fill in the configuration in Logto](#fill-in-the-configuration-in-logto)
    - [Client ID](#client-id)
    - [Client Secret](#client-secret)
    - [Cloud Instance](#cloud-instance)
    - [Tenant ID](#tenant-id)
    - [Prompts](#prompts)
    - [Scopes](#scopes)
  - [References](#references)

## Set up Microsoft Azure AD in the Azure Portal

- Visit the [Azure Portal](https://portal.azure.com/#home) and sign in with your Azure account. You need to have an active subscription to access Microsoft Azure AD.
- Click the **Azure Active Directory** from the services they offer, and click the **App Registrations** from the left menu.
- Click **New Registration** at the top, enter a description, select your **access type** and add your **Redirect URI**, which will redirect the user to the application after logging in. In our case, this will be `${your_logto_endpoint}/callback/${connector_id}`. e.g. `https://foo.logto.app/callback/${connector_id}`. (The `connector_id` can be also found on the top bar of the Logto Admin Console connector details page)
  > You can copy the `Callback URI` in the configuration section.
- Select Web as Platform.

## Fill in the configuration in Logto

| Name          | Type     |
| ------------- | -------- |
| clientId      | string   |
| clientSecret  | string   |
| tenantId      | string   |
| cloudInstance | string   |
| prompts       | string[] |
| scopes        | string?  |

### Client ID

You may find the **Application (client) ID** in the **Overview** section of your newly created application in the Azure Portal.

### Client Secret

- In your newly created application, click the **Certificates & Secrets** to get a client secret, and click the **New client secret** from the top.
- Enter a description and an expiration.
- This will only show your client secret once. Fill the **value** to the Logto connector configuration and save it to a secure location.

### Cloud Instance

Usually, it is `https://login.microsoftonline.com/`. See [Azure AD authentication endpoints](https://learn.microsoft.com/en-us/azure/active-directory/develop/authentication-national-cloud#azure-ad-authentication-endpoints) for more information.

### Tenant ID

Logto will use this field to construct the authorization endpoints. This value is dependent on the **access type** you selected when creating the application in the Azure Portal.

- If you select **Accounts in this organizational directory only** for access type then you need to enter your **{TenantID}**. You can find the tenant ID in the **Overview** section of your Azure Active Directory.
- If you select **Accounts in any organizational directory** for access type then you need to enter **organizations**.
- If you select **Accounts in any organizational directory or personal Microsoft accounts** for access type then you need to enter **common**.
- If you select **Personal Microsoft accounts only** for access type then you need to enter **consumers**.

### Prompts

The `prompts` field is an array of strings that specifies the type of user interaction that is required. The string can be one of the following values:

- `prompt=login` forces the user to enter their credentials on that request, negating single-sign on.
- `prompt=none` is the opposite. It ensures that the user isn't presented with any interactive prompt. If the request can't be completed silently by using single-sign on, the Microsoft identity platform returns an `interaction_required` error.
- `prompt=consent` triggers the OAuth consent dialog after the user signs in, asking the user to grant permissions to the app.
- `prompt=select_account` interrupts single sign-on providing account selection experience listing all the accounts either in session or any remembered account or an option to choose to use a different account altogether.

Logto will concatenate the prompts with a space as the value of `prompt` in the authorization URL.

### Scopes

The `scopes` field is a space-separated list of scopes the application needs. The list of scopes can be found in the [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference).

The default scopes are `User.Read`, leave this field empty unless you need other scopes.

## References

- [Web app that signs in users](https://docs.microsoft.com/en-us/azure/active-directory/develop/scenario-web-app-sign-user-overview)
