import test from "node:test";
import assert from "node:assert/strict";

import { assertSafeRemoteUrl, isPrivateIpAddress } from "../scripts/lib/url-safety.mjs";

test("private ip detection blocks local and metadata ranges", () => {
  assert.equal(isPrivateIpAddress("127.0.0.1"), true);
  assert.equal(isPrivateIpAddress("10.0.0.5"), true);
  assert.equal(isPrivateIpAddress("169.254.169.254"), true);
  assert.equal(isPrivateIpAddress("8.8.8.8"), false);
});

test("url safety rejects localhost and non-http protocols", async () => {
  await assert.rejects(() => assertSafeRemoteUrl("http://localhost"), /not allowed/i);
  await assert.rejects(() => assertSafeRemoteUrl("file:///tmp/secret"), /only http/i);
});

test("url safety can allow public hosts with an injected resolver", async () => {
  const result = await assertSafeRemoteUrl("https://example.com/path", {
    lookupAll: async () => [{ address: "93.184.216.34", family: 4 }],
  });
  assert.equal(result.hostname, "example.com");
});
