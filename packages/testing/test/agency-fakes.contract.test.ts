import {
  describeBrandingRepositoryContract,
  describeInvitationRepositoryContract,
  describeMailerContract,
  describeMembershipRepositoryContract,
  describeReportRecipientRepositoryContract,
} from "../contracts";
import {
  InMemoryBrandingRepository,
  InMemoryInvitationRepository,
  InMemoryMembershipRepository,
  InMemoryReportRecipientRepository,
  RecordingMailer,
} from "../src";

describeMembershipRepositoryContract(
  "InMemoryMembershipRepository",
  () => new InMemoryMembershipRepository(),
);
describeInvitationRepositoryContract(
  "InMemoryInvitationRepository",
  () => new InMemoryInvitationRepository(),
);
describeBrandingRepositoryContract(
  "InMemoryBrandingRepository",
  () => new InMemoryBrandingRepository(),
);
describeReportRecipientRepositoryContract(
  "InMemoryReportRecipientRepository",
  () => new InMemoryReportRecipientRepository(),
);
describeMailerContract("RecordingMailer", () => {
  const mailer = new RecordingMailer();
  return {
    mailer,
    delivered: () =>
      mailer.sent.map((m) => ({
        to: [...m.to],
        fromName: m.fromName,
        replyTo: m.replyTo,
        subject: m.subject,
        html: m.html,
        text: m.text,
      })),
    rejectNext: () => {
      mailer.failNext({
        code: "mailer_rejected",
        message: "Sender not verified",
        retryable: false,
      });
    },
  };
});
