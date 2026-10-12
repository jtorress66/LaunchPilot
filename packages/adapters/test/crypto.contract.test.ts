import {
  describeIdGeneratorContract,
  describePasswordHasherContract,
  describeTokenCipherContract,
  describeTokenGeneratorContract,
} from "@launchpilot/testing/contracts";
import { randomBytes } from "node:crypto";
import {
  AesGcmTokenCipher,
  RandomTokenGenerator,
  ScryptPasswordHasher,
  UuidIdGenerator,
} from "../src";

describePasswordHasherContract("ScryptPasswordHasher", () => new ScryptPasswordHasher());
describeTokenGeneratorContract("RandomTokenGenerator", () => new RandomTokenGenerator(), {
  minLength: 43,
});
describeIdGeneratorContract("UuidIdGenerator", () => new UuidIdGenerator());
describeTokenCipherContract(
  "AesGcmTokenCipher",
  () => new AesGcmTokenCipher(randomBytes(32).toString("base64")),
);
