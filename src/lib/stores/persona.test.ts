import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';
import {
  personaStore,
  getPersonaName,
  type Persona
} from './persona';

// Mock browser environment
vi.stubGlobal('localStorage', {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn()
});

describe('persona store', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    personaStore.reset();
  });

  it('should have default null persona', () => {
    const persona = get(personaStore);
    expect(persona).toBe(null);
  });

  it('should set lawyer persona', () => {
    personaStore.setPersona('lawyer');
    expect(get(personaStore)).toBe('lawyer');
  });

  it('should set entrepreneur persona', () => {
    personaStore.setPersona('entrepreneur');
    expect(get(personaStore)).toBe('entrepreneur');
  });

  it('should set citizen persona', () => {
    personaStore.setPersona('citizen');
    expect(get(personaStore)).toBe('citizen');
  });

  it('should set student persona', () => {
    personaStore.setPersona('student');
    expect(get(personaStore)).toBe('student');
  });

  it('should allow setting persona to null', () => {
    personaStore.setPersona('lawyer');
    expect(get(personaStore)).toBe('lawyer');

    personaStore.setPersona(null);
    expect(get(personaStore)).toBe(null);
  });

  it('should clear persona correctly', () => {
    personaStore.setPersona('entrepreneur');
    expect(get(personaStore)).toBe('entrepreneur');

    personaStore.clearPersona();
    expect(get(personaStore)).toBe(null);
  });

  it('should reset to null', () => {
    personaStore.setPersona('student');
    expect(get(personaStore)).toBe('student');

    personaStore.reset();
    expect(get(personaStore)).toBe(null);
  });

  it('should update persona multiple times', () => {
    personaStore.setPersona('lawyer');
    expect(get(personaStore)).toBe('lawyer');

    personaStore.setPersona('citizen');
    expect(get(personaStore)).toBe('citizen');

    personaStore.setPersona('student');
    expect(get(personaStore)).toBe('student');
  });
});

describe('getPersonaName helper', () => {
  it('should return French name for lawyer', () => {
    expect(getPersonaName('lawyer', 'fr')).toBe('Avocat / Juriste');
  });

  it('should return English name for lawyer', () => {
    expect(getPersonaName('lawyer', 'en')).toBe('Lawyer / Legal Professional');
  });

  it('should return French name for entrepreneur', () => {
    expect(getPersonaName('entrepreneur', 'fr')).toBe('Entrepreneur');
  });

  it('should return English name for entrepreneur', () => {
    expect(getPersonaName('entrepreneur', 'en')).toBe('Entrepreneur');
  });

  it('should return French name for citizen', () => {
    expect(getPersonaName('citizen', 'fr')).toBe('Citoyen');
  });

  it('should return English name for citizen', () => {
    expect(getPersonaName('citizen', 'en')).toBe('Citizen');
  });

  it('should return French name for student', () => {
    expect(getPersonaName('student', 'fr')).toBe('Étudiant');
  });

  it('should return English name for student', () => {
    expect(getPersonaName('student', 'en')).toBe('Student');
  });

  it('should return "Non sélectionné" for null persona in French', () => {
    expect(getPersonaName(null, 'fr')).toBe('Non sélectionné');
  });

  it('should return "Not selected" for null persona in English', () => {
    expect(getPersonaName(null, 'en')).toBe('Not selected');
  });

  it('should default to French when language not specified', () => {
    expect(getPersonaName('lawyer')).toBe('Avocat / Juriste');
    expect(getPersonaName(null)).toBe('Non sélectionné');
  });
});
