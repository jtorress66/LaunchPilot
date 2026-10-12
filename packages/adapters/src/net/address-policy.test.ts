import type { LookupAddress } from "node:dns";
import { describe, expect, it } from "vitest";
import { guardedLookup, isBlockedAddress } from "./address-policy";

const strict = { allowPrivateNetwork: false };
const dev = { allowPrivateNetwork: true };

describe("isBlockedAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "172.31.255.255",
    "192.168.1.10",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fc00::1",
    "fd12:3456::1",
    "::ffff:127.0.0.1",
  ])("blocks the private or loopback address %s", (ip) => {
    expect(isBlockedAddress(ip, strict)).toBe(true);
  });

  it.each(["169.254.169.254", "fe80::1", "224.0.0.1", "255.255.255.255"])(
    "always blocks the link-local, metadata or multicast address %s, even in development",
    (ip) => {
      expect(isBlockedAddress(ip, dev)).toBe(true);
    },
  );

  it.each(["93.184.216.34", "1.1.1.1", "172.32.0.1", "2606:4700:4700::1111"])(
    "allows the public address %s",
    (ip) => {
      expect(isBlockedAddress(ip, strict)).toBe(false);
    },
  );

  it("allows private addresses only when private networking is enabled", () => {
    expect(isBlockedAddress("127.0.0.1", dev)).toBe(false);
    expect(isBlockedAddress("192.168.1.10", dev)).toBe(false);
  });

  it("blocks anything that is not an IP address", () => {
    expect(isBlockedAddress("not-an-ip", dev)).toBe(true);
  });
});

const resolvingTo =
  (addresses: LookupAddress[]) =>
  (
    _host: string,
    _options: { all: true },
    callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
  ) => {
    callback(null, addresses);
  };

const lookupWith = (
  policy: { allowPrivateNetwork: boolean },
  addresses: LookupAddress[],
  options: { all?: boolean } = {},
) =>
  new Promise<{ error: NodeJS.ErrnoException | null; result: unknown }>((resolve) => {
    guardedLookup(policy, resolvingTo(addresses))("site.test", options, (error, ...result) => {
      resolve({ error, result });
    });
  });

describe("guardedLookup", () => {
  it("passes a public address through to the connection", async () => {
    const { error, result } = await lookupWith(strict, [{ address: "93.184.216.34", family: 4 }]);
    expect(error).toBeNull();
    expect(result).toEqual(["93.184.216.34", 4]);
  });

  it("returns every address when the caller asks for all of them", async () => {
    const addresses = [{ address: "93.184.216.34", family: 4 }];
    const { result } = await lookupWith(strict, addresses, { all: true });
    expect(result).toEqual([addresses]);
  });

  it("refuses to connect when any resolved address is private", async () => {
    const { error } = await lookupWith(strict, [
      { address: "93.184.216.34", family: 4 },
      { address: "10.0.0.5", family: 4 },
    ]);
    expect(error?.code).toBe("EADDRBLOCKED");
  });

  it("passes a DNS failure through unchanged", async () => {
    const failure = Object.assign(new Error("not found"), { code: "ENOTFOUND" });
    const error = await new Promise<NodeJS.ErrnoException | null>((resolve) => {
      guardedLookup(strict, (_h, _o, callback) => {
        callback(failure, []);
      })("missing.test", {}, (e) => {
        resolve(e);
      });
    });
    expect(error).toBe(failure);
  });
});
