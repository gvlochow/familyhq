import { describe, it, expect } from "vitest"

import { esIpPublica } from "./ip-privada"

describe("esIpPublica", () => {
  it("acepta IPs públicas reales", () => {
    expect(esIpPublica("8.8.8.8")).toBe(true)
    expect(esIpPublica("1.1.1.1")).toBe(true)
    expect(esIpPublica("172.15.0.1")).toBe(true) // justo fuera del rango privado
    expect(esIpPublica("172.32.0.1")).toBe(true)
  })

  it("rechaza loopback, this-network y privadas IPv4", () => {
    expect(esIpPublica("127.0.0.1")).toBe(false)
    expect(esIpPublica("0.0.0.0")).toBe(false)
    expect(esIpPublica("10.1.2.3")).toBe(false)
    expect(esIpPublica("192.168.1.10")).toBe(false)
    expect(esIpPublica("172.16.0.1")).toBe(false)
    expect(esIpPublica("172.31.255.255")).toBe(false)
  })

  it("rechaza link-local (metadata de la nube) y CGNAT", () => {
    expect(esIpPublica("169.254.169.254")).toBe(false)
    expect(esIpPublica("100.64.0.1")).toBe(false)
    expect(esIpPublica("100.127.255.255")).toBe(false)
  })

  it("clasifica IPv6 loopback, link-local y ULA como no públicas", () => {
    expect(esIpPublica("::1")).toBe(false)
    expect(esIpPublica("::")).toBe(false)
    expect(esIpPublica("fe80::1")).toBe(false)
    expect(esIpPublica("fc00::1")).toBe(false)
    expect(esIpPublica("fd12:3456::1")).toBe(false)
  })

  it("acepta IPv6 pública", () => {
    expect(esIpPublica("2606:4700:4700::1111")).toBe(true)
  })

  it("desenmascara IPv4 mapeada en IPv6 y hereda su clasificación", () => {
    expect(esIpPublica("::ffff:127.0.0.1")).toBe(false)
    expect(esIpPublica("::ffff:169.254.169.254")).toBe(false)
    expect(esIpPublica("::ffff:8.8.8.8")).toBe(true)
  })
})
