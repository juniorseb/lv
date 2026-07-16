import { ValueTransformer } from 'typeorm';

// PostgreSQL renvoie les colonnes NUMERIC sous forme de chaîne (pour préserver
// la précision). Ce transformer les convertit en `number` côté application.
export class ColumnNumericTransformer implements ValueTransformer {
  to(value: number | null): number | null {
    return value;
  }

  from(value: string | null): number | null {
    return value === null || value === undefined ? null : parseFloat(value);
  }
}
