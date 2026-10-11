import {
  describeBriefRepositoryContract,
  describeCampaignRepositoryContract,
  describeContentItemRepositoryContract,
  describeProductRepositoryContract,
  describeTaskRepositoryContract,
  describeWorkspaceRepositoryContract,
} from "../contracts";
import {
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
