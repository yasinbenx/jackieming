// Platzwahl beim Ansprechen
import { describe, expect, it } from 'vitest';
import { SEATS } from '../src/world/layout';
import { freeSeatAt, seatTaken } from '../src/world/seating';

const main = SEATS.filter((s) => s.table === 'main');
const guest = main.find((s) => s.free)!;
const jackie = main[0]!;
const yao = main[1]!;

describe('Haupttisch', () => {
  it('hat einen freien Gastplatz', () => {
    expect(guest).toBeDefined();
  });

  it('Gastplatz liegt neben Jackie und Yao (höchstens 1,8 m)', () => {
    expect(Math.hypot(guest.x - jackie.x, guest.z - jackie.z)).toBeLessThan(1.8);
    expect(Math.hypot(guest.x - yao.x, guest.z - yao.z)).toBeLessThan(1.8);
  });

  it('Gastplatz blickt zum Tisch', () => {
    const t = { x: (jackie.x + yao.x) / 2, z: (jackie.z + yao.z) / 2 };
    const look = { x: Math.sin(guest.yaw), z: Math.cos(guest.yaw) };
    const to = { x: t.x - guest.x, z: t.z - guest.z };
    expect(look.x * to.x + look.z * to.z).toBeGreaterThan(0);
  });
});

describe('freeSeatAt', () => {
  const heroes = [
    { x: jackie.x, z: jackie.z, seat: jackie },
    { x: yao.x, z: yao.z, seat: yao },
  ];

  it('findet den freien Platz', () => {
    expect(freeSeatAt('main', SEATS, heroes)).toBe(guest);
  });

  it('belegt, wenn jemand darauf sitzt', () => {
    expect(freeSeatAt('main', SEATS, [...heroes, { x: guest.x, z: guest.z, seat: guest }])).toBeNull();
  });

  it('belegt, wenn jemand darauf steht', () => {
    expect(seatTaken(guest, [{ x: guest.x + 0.1, z: guest.z }])).toBe(true);
    expect(seatTaken(guest, [{ x: guest.x + 1, z: guest.z }])).toBe(false);
  });

  it('wählt den nächsten freien Platz', () => {
    const free = SEATS.filter((s) => s.table === 'free' && s.free);
    if (free.length < 2) return;
    const near = free[1]!;
    expect(freeSeatAt('free', SEATS, [], { x: near.x, z: near.z })).toBe(near);
  });
});
