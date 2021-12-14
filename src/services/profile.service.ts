import { RedisCacheService } from 'src/redisCache.service';
import { Profile } from 'src/models/profile.model';
import axios from 'axios';
import { Injectable } from '@nestjs/common';

@Injectable()
export class ProfileService {
  constructor(private readonly redisCacheService: RedisCacheService) {}

  /** Get profile from APS and cache for 7 days */
  async getProfile(uuid: string): Promise<Profile> {
    let profile = await this.redisCacheService.get(`uuid-${uuid}`);
    if (!profile) {
      const query = {
        operationName: 'getProfile',
        variables: { uuid },
        query: `
            query getProfile($uuid: String!) {
              employeeWithUUID(id: $uuid) {
                user_id
                rcno
                full_name
                email
                tel_mobile
                tel_office
                tel_extension
                post
                division
                department
                section
                unit
              }
            }
            `,
      };
      const options = {
        headers: {
          Authorization: `Bearer ${process.env.APS_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      };
      profile = new Profile();
      await axios
        .post(process.env.APS_API_URL, JSON.stringify(query), options)
        .then((data) => {
          if (data.status === 200 && data.data.data.employeeWithUUID) {
            const respEmp = data.data.data.employeeWithUUID;
            profile.userId = respEmp.user_id;
            profile.rcno = respEmp.rcno;
            profile.fullName = respEmp.full_name;
            profile.email = respEmp.email;
            profile.telMobile = respEmp.tel_mobile;
            profile.telOffice = respEmp.tel_office;
            profile.telExtension = respEmp.tel_extension;
            profile.post = respEmp.post;
            profile.division = respEmp.division;
            profile.department = respEmp.department;
            profile.section = respEmp.section;
            profile.unit = respEmp.unit;
          }
        })
        .catch((error) => console.log(error));
      const secondsInWeek = 7 * 24 * 60 * 60;
      await this.redisCacheService.set(`uuid-${uuid}`, profile, secondsInWeek);
    }
    return profile;
  }
}
