/* Button mappings for the WLmouse 64-byte command interface. Hardware untested. */
(function (root) {
  'use strict';
  const Driver = root.WLM.Driver;
  const ids = Object.freeze([1, 2, 3, 4, 5]);
  const byte = n => Number.isInteger(n) && n >= 0 && n <= 255;
  function validate(id, type, data) {
    if (!ids.includes(id)) throw new RangeError('Unsupported physical button');
    if (!Array.isArray(data) || !data.every(byte)) throw new RangeError('Invalid button data');
    const valid = type === 0 && data.length === 0 ||
      type === 1 && data.length === 1 && [1, 2, 3, 4, 5, 16, 17].includes(data[0]) ||
      type === 4 && data.length === 2 && (data[0] !== 0 || data[1] !== 0) ||
      type === 5 && data.length === 2 && (data[0] !== 0 || data[1] !== 0) ||
      type === 7 && data.length === 1 && [1, 2, 6].includes(data[0]) ||
      [8, 13, 14].includes(type) && data.length === 1 && data[0] === 3;
    if (!valid) throw new RangeError('Unsupported button assignment');
  }
  async function read(driver, id, verifyIdentity = false) {
    const response = await driver._request(3, 128, 15, [driver.profile, id, 0, 255, 10]);
    if (response.length < 11) throw new Error('Short button response');
    // Candidate echo fields are unconfirmed on hardware. Refuse writes if absent.
    if (verifyIdentity && (response[6] !== driver.profile || response[7] !== id))
      throw new Error('Button identity could not be verified; remapping is unavailable');
    const length = response[10];
    if (length > 10 || response.length < 11 + length) throw new Error('Invalid button response length');
    return {id, type: response[9], data: Array.from(response.slice(11, 11 + length))};
  }
  async function checkProfile(driver) {
    if (await driver._profile() !== driver.profile) {
      driver.ready = false;
      throw new Error('Active profile changed; read settings again');
    }
  }
  Driver.prototype.getButtons = function () {
    return this._run(async () => {
      if (!this.profile) throw new Error('Read the active profile first');
      await checkProfile(this);
      const result = [];
      for (const id of ids) result.push(await read(this, id));
      await checkProfile(this);
      return result;
    });
  };
  Driver.prototype.setButton = function (id, type, data) {
    validate(id, type, data);
    const next = data.slice();
    return this._run(async () => {
      this._requireReady();
      await checkProfile(this);
      const current = [];
      for (const button of ids) current.push(await read(this, button, true));
      await checkProfile(this);
      const leftCount = current.filter(b => b.id === id ? type === 1 && next[0] === 1 : b.type === 1 && b.data[0] === 1).length;
      if (!leftCount) throw new Error('At least one button must remain assigned to left click');
      await this._request(3, 0, 5 + next.length, [this.profile, id, 0, type, next.length, ...next]);
      const actual = await read(this, id, true);
      if (actual.type !== type || actual.data.length !== next.length || actual.data.some((v, i) => v !== next[i])) throw new Error('Button readback did not match');
      return actual;
    });
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
