import { describe, expect, it } from "vitest";
import { dominantLanguage, writesIn } from "./language-check";

const english = "This is the guide for founders who want to know what to measure and how to start.";
const german =
  "Das ist der Leitfaden für Gründer, die wissen wollen, was sie messen und wie sie starten.";
const portuguese =
  "Este é o guia para fundadores que querem saber o que medir e como começar com isso.";
const spanish =
  "Esta es la guía para fundadores que quieren saber qué medir y cómo empezar con ello.";

describe("dominantLanguage", () => {
  it.each([
    [english, "en"],
    [german, "de"],
    [portuguese, "pt"],
    [spanish, "es"],
  ])("recognises %j as %s", (text, language) => {
    expect(dominantLanguage(text)).toBe(language);
  });

  it("has no answer for text without common words", () => {
    expect(dominantLanguage("Nuvantre 2026")).toBeUndefined();
  });
});

describe("writesIn", () => {
  it("checks the languages it knows and trusts the others", () => {
    expect(writesIn(german, "de")).toBe(true);
    expect(writesIn(english, "de")).toBe(false);
    expect(writesIn(english, "ja")).toBe(true);
  });
});
