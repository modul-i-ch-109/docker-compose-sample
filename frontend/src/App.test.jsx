import React from 'react';
import { render, screen } from '@testing-library/react';
import axios from 'axios';
import App from './App';

vi.mock('axios');

it('renders without crashing', async () => {
  axios.get.mockResolvedValue({ data: { data: [{ text: 'Test todo' }] } });
  render(<App />);
  expect(screen.getByText('Todos')).toBeTruthy();
  expect(await screen.findByText('Test todo')).toBeTruthy();
});
