import React from 'react';
import SearchForm from './components/SearchForm';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>InfluFind - Поиск локальных инфлюенсеров</h1>
        <SearchForm />
      </header>
    </div>
  );
}

export default App;