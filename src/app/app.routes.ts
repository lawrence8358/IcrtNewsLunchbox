import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { VocabularyBookComponent } from './pages/vocabulary-book/vocabulary-book.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'vocabulary-book', component: VocabularyBookComponent },
  { path: '**', redirectTo: '/home' }
];
