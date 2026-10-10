import {extractTicket, LOGIN_FLOWS} from '@/garmin/auth';

describe('Garmin login helpers', () => {
  it('extracts service tickets from redirect URLs and widget HTML', () => {
    expect(extractTicket('https://connect.garmin.com/app?ticket=ST-0123-abcXYZ-cas')).toBe('ST-0123-abcXYZ-cas');
    expect(extractTicket('var response_url = "https://sso.garmin.com/sso/embed?ticket=ST-99-zz-cas";')).toBe('ST-99-zz-cas');
    expect(extractTicket('https://connect.garmin.com/app?foo=1&ticket=ST-1-a&next=2')).toBe('ST-1-a');
    expect(extractTicket('https://sso.garmin.com/portal/sso/en-US/sign-in')).toBeNull();
  });

  it('builds each flow so the ticket service matches the exchange service_url', () => {
    for (const flow of LOGIN_FLOWS) {
      expect(decodeURIComponent(flow.url)).toContain(`service=${flow.serviceUrl}`);
    }
  });
});
