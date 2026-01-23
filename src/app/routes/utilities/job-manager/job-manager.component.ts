import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatOptionModule } from '@angular/material/core';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { PageEvent } from '@angular/material/paginator';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MtxDatetimepickerModule } from '@ng-matero/extensions/datetimepicker';
import { MtxGridColumn, MtxGridModule } from '@ng-matero/extensions/grid';
import { MtxSelectModule } from '@ng-matero/extensions/select';
import { FormlyModule } from '@ngx-formly/core';
import { TranslateModule } from '@ngx-translate/core';
import { BreadcrumbComponent, PageHeaderComponent } from '@shared';
import { JobManagerService } from './job-manager.service';
import { finalize } from 'rxjs';
import { schedulerJobInfo, schedulerJobInfoDetail } from '@core';

@Component({
  selector: 'app-job-manager',
  standalone: true,
  imports: [MtxGridModule,
            ReactiveFormsModule,
            FormsModule,
            MatDialogModule,
            MatButtonModule,
            MatCardModule,
            MatCheckboxModule,
            MatFormFieldModule,
            MatIconModule,
            MatInputModule,
            MatRadioModule,
            MatSelectModule,
            MatOptionModule,
            FormlyModule,
            MatDatepickerModule,
            MtxDatetimepickerModule,
            TranslateModule,
            MtxSelectModule,
            CommonModule,
            MatMenuModule,
            MatListModule,
            MatDividerModule,],
  templateUrl: './job-manager.component.html',
  styleUrl: './job-manager.component.scss',
  providers: [DatePipe]
})
export class JobManagerComponent {

constructor(public datepipe: DatePipe) {}
private readonly jobService = inject(JobManagerService);

isLoading= false;
list: any[] = [];
total = 0;
noResult='Nenhum registro encontrado';

  columns: MtxGridColumn[] = [
        { header: 'Cod.', field: 'jobId', width: '50px', resizable: false, formatter: (data: any) => `<span class="label">${data?.jobId?data?.jobId:''}</span>`},
        { header: 'Nome', field: 'jobName', width: '100%', resizable: false, formatter: (data: any) => `<span class="label">${data?.jobName?data?.jobName:''}</span>`
        },
        { header: 'Ult. Execução', field: 'prev_fire_time', width: '150px', resizable: false, formatter: (data: any) => `<span class="label">${data?.prev_fire_time?this.datepipe.transform(data?.prev_fire_time, 'dd/MM/yyyy HH:mm'):''}</span>`},
        { header: 'Prox. Execução', field: 'next_fire_time', width: '150px', resizable: false, formatter: (data: any) => `<span class="label">${data?.next_fire_time?this.datepipe.transform(data?.next_fire_time, 'dd/MM/yyyy HH:mm'):''}</span>`},
        { header: 'Status', field: 'jobStatus', width: '150px', resizable: false, formatter: (data: any) => `<span class="label">${data?.jobStatus?data?.jobStatus:''}</span>`},
        { header: 'Status Trigger', field: 'trigger_state', width: '150px', resizable: false, formatter: (data: any) => `<span class="label">${data?.trigger_state?data?.trigger_state:''}</span>`},
        {
          header: 'Operação',
          field: 'operacao',
          pinned: 'right',
          minWidth: 250,
          width: '250px',
          right: '0px',
          type: 'button',
          resizable: false,
          buttons: [
            {
              type: 'icon',
              text: 'Executar',
              icon: 'settings_power',
              color: 'primary',
              tooltip: 'Executar',
              click: (data) => this.run(data),
            },
            {
              type: 'icon',
              text: 'Pausar',
              icon: 'pause',
              color: 'primary',
              tooltip: 'Pausar',
              click: (data) => this.pause(data),
            },
            {
              type: 'icon',
              text: 'Reiniciar',
              icon: 'autorenew',
              color: 'primary',
              tooltip: 'Reiniciar',
              click: (data) => this.resume(data),
            },
            {
              type: 'icon',
              text: 'Editar',
              icon: 'edit',
              color: 'primary',
              tooltip: 'Editar',
              click: (data) => alert(data.jobName),
            },
            {
              type: 'icon',
              text: 'Remover',
              icon: 'delete',
              color: 'warn',
              tooltip: 'Remover',
              iif: data => data.jobStatus != "REMOVED",
              click: (data) => this.remove(data),
            },
            {
              type: 'icon',
              text: 'Recriar',
              icon: 'build',
              color: 'accent',
              tooltip: 'Recriar',
              iif: data => data.jobStatus == "REMOVED",
              click: (data) => this.recreate(data),
            },
          ],
        },
      ];

  ngOnInit() {
    this.search();
  }

  run(job:schedulerJobInfoDetail){
    this.jobService.runJob(job).pipe(
      finalize(() => {
        this.search();
      })
    ).subscribe(dados =>{
        console.log(dados);
    });
  }

  pause(job:schedulerJobInfoDetail){
    this.jobService.pauseJob(job).pipe(
      finalize(() => {
        this.search();
      })
    ).subscribe(dados =>{
        console.log(dados);
    });
  }

  resume(job:schedulerJobInfoDetail){
    this.jobService.resumeJob(job).pipe(
      finalize(() => {
        this.search();
      })
    ).subscribe(dados =>{
        console.log(dados);
    });
  }

  remove(job:schedulerJobInfoDetail){
    this.jobService.removeJob(job).pipe(
      finalize(() => {
        this.search();
      })
    ).subscribe(dados =>{
        console.log(dados);
    });
  }

  recreate(job:schedulerJobInfoDetail){
    this.jobService.recreateJob(job).pipe(
      finalize(() => {
        this.search();
      })
    ).subscribe(dados =>{
        console.log(dados);
    });
  }

  restart(job:schedulerJobInfoDetail){
    this.jobService.restartJob(job).pipe(
      finalize(() => {
        this.search();
      })
    ).subscribe(dados =>{
        console.log(dados);
    });
  }

  search() {
      this.isLoading = true;
      this.jobService.carregarJob().pipe(
        finalize(() => {
          this.isLoading = false;
        })
      ).subscribe(dados =>{
          this.list = dados;
          this.total = dados.totalElements;
      });
    }

  changeSelect(event:any){}
  changeSelectPage(e: PageEvent){}

}
