import React from 'react';
import SearchForm from './components/SearchForm';
import ParserStats from './components/ParserStats';
import LocationDatabase from './components/LocationDatabase';
import './App.css';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <h1>InfluFind - Поиск локальных инфлюенсеров</h1>
        <SearchForm />
        <ParserStats />
        <LocationDatabase />
      </header>
    </div>
  );
}

export default App;