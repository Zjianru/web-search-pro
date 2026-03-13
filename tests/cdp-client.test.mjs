import test from "node:test";
import assert from "node:assert/strict";

import { CdpClient } from "../scripts/lib/cdp-client.mjs";

class FakeSocket extends EventTarget {
  constructor() {
    super();
    this.sent = [];
  }

  send(payload) {
    this.sent.push(payload);
  }

  close() {
    this.dispatchEvent(new Event("close"));
  }
}

test("cdp client rejects pending requests cleanly when the socket closes", async () => {
  const socket = new FakeSocket();
  const client = new CdpClient(socket);

  const pending = client.send("Page.enable");
  assert.equal(socket.sent.length, 1);

  socket.dispatchEvent(new Event("close"));

  await assert.rejects(pending, /CDP socket closed/i);
});
