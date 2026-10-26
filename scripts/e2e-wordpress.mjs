// A real WordPress blog for the SEO E2E gate: MariaDB + WordPress in Docker, installed with
// wp-cli, plus an Application Password for the admin user. Dev/test only.
import { GenericContainer, Network, Wait } from "testcontainers";

const WP_CLI = "https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar";

const exec = async (container, command) => {
  const { exitCode, output } = await container.exec(command);
  if (exitCode !== 0) throw new Error(`${command.join(" ")} failed:\n${output}`);
  return output.trim();
};

export const startWordPress = async () => {
  const network = await new Network().start();
  const db = await new GenericContainer("mariadb:11.4")
    .withNetwork(network)
    .withNetworkAliases("wpdb")
    .withEnvironment({
      MARIADB_ROOT_PASSWORD: "root",
      MARIADB_DATABASE: "wordpress",
      MARIADB_USER: "wordpress",
      MARIADB_PASSWORD: "wordpress",
    })
    .withWaitStrategy(Wait.forLogMessage(/ready for connections/i, 2))
    .start();
  const wp = await new GenericContainer("wordpress:6.8-apache")
    .withNetwork(network)
    .withEnvironment({
      WORDPRESS_DB_HOST: "wpdb",
      WORDPRESS_DB_USER: "wordpress",
      WORDPRESS_DB_PASSWORD: "wordpress",
      WORDPRESS_DB_NAME: "wordpress",
      // "local" lets WordPress accept Application Passwords over plain http.
      WORDPRESS_CONFIG_EXTRA: "define('WP_ENVIRONMENT_TYPE', 'local');",
    })
    .withExposedPorts(80)
    .withWaitStrategy(Wait.forHttp("/wp-includes/images/w-logo-blue.png", 80))
    .start();

  const url = `http://${wp.getHost()}:${wp.getMappedPort(80)}`;
  const phar = Buffer.from(await (await fetch(WP_CLI)).arrayBuffer());
  await wp.copyContentToContainer([{ content: phar, target: "/usr/local/bin/wp", mode: 0o755 }]);
  const wpCli = (...args) =>
    exec(wp, ["php", "/usr/local/bin/wp", "--allow-root", "--path=/var/www/html", ...args]);

  await wpCli(
    "core",
    "install",
    `--url=${url}`,
    "--title=Nuvantre E2E Blog",
    "--admin_user=admin",
    "--admin_password=e2e-admin-password",
    "--admin_email=admin@nuvantre.test",
    "--skip-email",
  );
  const password = await wpCli(
    "user",
    "application-password",
    "create",
    "admin",
    "nuvantre",
    "--porcelain",
  );

  return {
    env: { E2E_WP_URL: `${url}/`, E2E_WP_USER: "admin", E2E_WP_APP_PASSWORD: password },
    stop: async () => {
      await wp.stop();
      await db.stop();
      await network.stop();
    },
  };
};
