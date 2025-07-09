import { Routes } from '@angular/router';
import { HomeComponent } from './pages/home/home.component';
import { VocabularyBookComponent } from './pages/vocabulary-book/vocabulary-book.component';
import { VocabularyQuizComponent } from './pages/vocabulary-quiz/vocabulary-quiz.component';

export const routes: Routes = [
  { path: '', redirectTo: '/home', pathMatch: 'full' },
  { path: 'home', component: HomeComponent },
  { path: 'vocabulary-book', component: VocabularyBookComponent },
  { path: 'vocabulary-quiz', component: VocabularyQuizComponent },
  { path: '**', redirectTo: '/home' }
];
