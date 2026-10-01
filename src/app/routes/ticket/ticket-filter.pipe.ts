// ticket-filter.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { TicketSprintDetalhado } from '@core';

@Pipe({
  name: 'ticketFilter',
  standalone: true
})
export class TicketFilterPipe implements PipeTransform {
  transform(tickets: TicketSprintDetalhado[], filtro: string): TicketSprintDetalhado[] {
    if (!filtro || filtro === '') {
      return tickets;
    }

    return tickets.filter(ticket => {
      const status = (ticket.statusEntrega || '').toLowerCase();
      return status === filtro.toLowerCase();
    });
  }
}
