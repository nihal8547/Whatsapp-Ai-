import { PageHead, Panel } from "@/components/ui";

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-8">
      <PageHead
        title="Terms and Conditions"
        lead="Please read these terms carefully before using our platform."
      />
      <Panel className="space-y-6 text-sm text-ink-soft leading-relaxed mt-6">
        <div>
          <h2 className="text-lg font-semibold text-ink mb-2">1. WhatsApp Account Responsibility & Liability</h2>
          <p>
            The User assumes sole and absolute responsibility for all WhatsApp accounts connected to or utilized with this platform.
            The Service Provider holds no liability or responsibility for any account flags, temporary suspensions, rate limits, permanent phone number bans, or chat history loss initiated by WhatsApp LLC, Meta Platforms, Inc., or automated anti-spam mechanisms.
            You acknowledge that using automation, bulk messaging, or third-party tools carries inherent risks under Meta’s Terms of Service, and you agree to operate entirely at your own risk.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink mb-2">2. Payment Terms, Grace Period & Deactivation</h2>
          <p>
            All subscription and usage fees must be paid on or before the designated invoice due date.
            A grace period of up to 30 calendar days (1 month) is granted for pending balances.
            If outstanding payments are not settled within this 30-day period, the account will be automatically deactivated. Failure to clear overdue balances may result in permanent termination of the account and deletion of all stored data, logs, and configurations.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink mb-2">3. Acceptable Use and Anti-Spam Policy</h2>
          <p>
            Users must strictly comply with WhatsApp’s Business and Commerce Policies.
            Distributing unsolicited commercial messages (spam), engaging in deceptive practices, transmitting malicious links, scraping data, or sending illegal, offensive, or harassing content is strictly prohibited.
            Violation of these standards will lead to immediate account termination without prior notice or right of appeal.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink mb-2">4. Non-Refundable Payments</h2>
          <p>
            All payments, including recurring subscriptions, feature add-ons, and account setup fees, are strictly non-refundable once the service has been provisioned or activated.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink mb-2">5. Third-Party Dependencies and Service Availability</h2>
          <p>
            This platform relies on integrations with Meta Platforms, Inc. and third-party API infrastructures.
            We do not warrant uninterrupted or error-free operations. We are not liable for any downtime, service disruptions, message delays, or feature limitations resulting from WhatsApp maintenance, network outages, or upstream API policy changes.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink mb-2">6. Account Security and Access</h2>
          <p>
            Users are responsible for safeguarding login credentials, two-factor authentication methods, and API keys. Any action, message dispatch, or configuration change performed under your login credentials will be treated as fully authorized by you.
          </p>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-ink mb-2">7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, the Service Provider shall not be liable for any indirect, incidental, punitive, or consequential damages, including loss of business, revenue, client relationships, or data, arising out of the use or inability to use this platform.
          </p>
        </div>
      </Panel>
    </div>
  );
}
