import { describeIdGeneratorContract, describeTokenCipherContract } from "../contracts";
import { FakeTokenCipher, SequentialIdGenerator } from "../src";

describeIdGeneratorContract("SequentialIdGenerator", () => new SequentialIdGenerator());
describeTokenCipherContract("FakeTokenCipher", () => new FakeTokenCipher());
