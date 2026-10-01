import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'contrastColor',
  standalone: true
})
export class ContrastColorPipe implements PipeTransform {
  transform(hexColor: string): string {
    if (!hexColor) return '#000000';
    // Remove o # se presente
    const color = hexColor.charAt(0) === '#' ? hexColor.substring(1, 7) : hexColor;
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);
    // Calcula luminância (fórmula WCAG)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }
}
