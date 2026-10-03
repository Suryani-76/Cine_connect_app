import http from 'k6/http';
import { sleep } from 'k6';
import { BASE_URL, standardOptions } from './config.js';
import browseJobs from './browse-jobs.js';
import talentSearch from './talent-search.js';
import notificationsPolling from './notifications-polling.js';

export const options = standardOptions;

export default function () {
  // 50% browse jobs, 30% search talent, 20% poll notifications
  const rand = Math.random();
  if (rand < 0.5) {
    browseJobs();
  } else if (rand < 0.8) {
    talentSearch();
  } else {
    notificationsPolling();
  }
}
