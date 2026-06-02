import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Sewer } from './sewer.component';

describe('Sewer', () => {
  let component: Sewer;
  let fixture: ComponentFixture<Sewer>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Sewer],
    }).compileComponents();

    fixture = TestBed.createComponent(Sewer);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
