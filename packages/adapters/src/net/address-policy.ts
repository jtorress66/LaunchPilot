import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { BlockList, isIP } from "node:net";

/**
 * SSRF protection for the crawler: decides which IP addresses it may connect to.
 * The founder supplies the URL, so it must never reach our own network or cloud metadata.
 */
export interface AddressPolicy {
  /** Development and test only: lets the crawler reach a site on localhost or a LAN. */
  readonly allowPrivateNetwork: boolean;
}

const subnets = (list: BlockList, cidrs: readonly string[]) => {
  for (const cidr of cidrs) {
    const [network = "", prefix = ""] = cidr.split("/");
    list.addSubnet(network, Number(prefix), network.includes(":") ? "ipv6" : "ipv4");
  }
  return list;
};

/** Never reachable: link-local (incl. cloud metadata at 169.254.169.254), multicast, reserved. */
const alwaysBlocked = subnets(new BlockList(), [
  "169.254.0.0/16",
  "224.0.0.0/4",
  "240.0.0.0/4",
  "fe80::/10",
  "ff00::/8",
  "fd00:ec2::254/128",
]);

/** Reachable only when the policy allows the private network. */
const privateNetwork = subnets(new BlockList(), [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "198.18.0.0/15",
  "::/128",
  "::1/128",
  "fc00::/7",
]);

const MAPPED_IPV4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i;

export const isBlockedAddress = (ip: string, policy: AddressPolicy): boolean => {
  const address = MAPPED_IPV4.exec(ip)?.[1] ?? ip;
  const family = isIP(address);
  if (family === 0) return true;
  const type = family === 4 ? "ipv4" : "ipv6";
  if (alwaysBlocked.check(address, type)) return true;
  return !policy.allowPrivateNetwork && privateNetwork.check(address, type);
};

type LookupAll = (
  hostname: string,
  options: { all: true },
  callback: (error: NodeJS.ErrnoException | null, addresses: LookupAddress[]) => void,
) => void;

type LookupCallback = (
  error: NodeJS.ErrnoException | null,
  address: string | LookupAddress[],
  family?: number,
) => void;

const defaultLookup: LookupAll = (hostname, options, callback) => {
  dnsLookup(hostname, options, callback);
};

/**
 * A `lookup` for `http.request` that refuses blocked addresses at connection time,
 * so a DNS answer that changes between checks (rebinding) cannot slip through.
 */
export const guardedLookup =
  (policy: AddressPolicy, lookup: LookupAll = defaultLookup) =>
  (hostname: string, options: { all?: boolean | undefined }, callback: LookupCallback): void => {
    lookup(hostname, { all: true }, (error, addresses) => {
      if (error) {
        callback(error, []);
        return;
      }
      if (addresses.some(({ address }) => isBlockedAddress(address, policy))) {
        callback(
          Object.assign(new Error(`${hostname} resolves to a blocked address`), {
            code: "EADDRBLOCKED",
          }),
          [],
        );
        return;
      }
      if (options.all === true) {
        callback(null, addresses);
        return;
      }
      const [first] = addresses;
      callback(null, first?.address ?? "", first?.family);
    });
  };
