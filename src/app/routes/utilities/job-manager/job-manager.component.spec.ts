import { ComponentFixture, TestBed } from '@angular/core/testing';

import { JobManagerComponent } from './job-manager.component';

describe('JobManagerComponent', () => {
  let component: JobManagerComponent;
  let fixture: ComponentFixture<JobManagerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JobManagerComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(JobManagerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
