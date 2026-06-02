import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Statement } from './statement.component';

describe('Statement', () => {
  let component: Statement;
  let fixture: ComponentFixture<Statement>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Statement],
    }).compileComponents();

    fixture = TestBed.createComponent(Statement);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
