import {
  describeChannelConnectionRepositoryContract,
  describeSocialProfileRepositoryContract,
  describeDirectoryCatalogContract,
  describeLaunchKitRepositoryContract,
  describeAnalyticsConnectionRepositoryContract,
  describeWeeklyReportRepositoryContract,
  describeAutopilotRunRepositoryContract,
  describeSubmissionRepositoryContract,
  describeBriefRepositoryContract,
  describeCampaignRepositoryContract,
  describeContentItemRepositoryContract,
  describeProductRepositoryContract,
  describeTaskRepositoryContract,
  describeWorkspaceRepositoryContract,
} from "../contracts";
import {
  InMemoryChannelConnectionRepository,
  InMemorySocialProfileRepository,
  InMemoryDirectoryCatalog,
  InMemoryLaunchKitRepository,
  InMemoryAnalyticsConnectionRepository,
  InMemoryWeeklyReportRepository,
  InMemoryAutopilotRunRepository,
  InMemorySubmissionRepository,
  InMemoryBriefRepository,
  InMemoryCampaignRepository,
  InMemoryContentItemRepository,
  InMemoryProductRepository,
  InMemoryTaskRepository,
  InMemoryWorkspaceRepository,
} from "../src";

describeWorkspaceRepositoryContract(
  "InMemoryWorkspaceRepository",
  () => new InMemoryWorkspaceRepository(),
);
describeProductRepositoryContract(
  "InMemoryProductRepository",
  () => new InMemoryProductRepository(),
);
describeBriefRepositoryContract("InMemoryBriefRepository", () => new InMemoryBriefRepository());
describeCampaignRepositoryContract(
  "InMemoryCampaignRepository",
  () => new InMemoryCampaignRepository(),
);
describeTaskRepositoryContract("InMemoryTaskRepository", () => new InMemoryTaskRepository());
describeContentItemRepositoryContract(
  "InMemoryContentItemRepository",
  () => new InMemoryContentItemRepository(),
);
describeChannelConnectionRepositoryContract(
  "InMemoryChannelConnectionRepository",
  () => new InMemoryChannelConnectionRepository(),
);
describeSocialProfileRepositoryContract(
  "InMemorySocialProfileRepository",
  () => new InMemorySocialProfileRepository(),
);
describeDirectoryCatalogContract(
  "InMemoryDirectoryCatalog",
  (directories) => new InMemoryDirectoryCatalog(directories),
);
describeLaunchKitRepositoryContract(
  "InMemoryLaunchKitRepository",
  () => new InMemoryLaunchKitRepository(),
);
describeSubmissionRepositoryContract(
  "InMemorySubmissionRepository",
  () => new InMemorySubmissionRepository(),
);

describeAnalyticsConnectionRepositoryContract(
  "InMemoryAnalyticsConnectionRepository",
  () => new InMemoryAnalyticsConnectionRepository(),
);
describeWeeklyReportRepositoryContract(
  "InMemoryWeeklyReportRepository",
  () => new InMemoryWeeklyReportRepository(),
);
describeAutopilotRunRepositoryContract(
  "InMemoryAutopilotRunRepository",
  () => new InMemoryAutopilotRunRepository(),
);
