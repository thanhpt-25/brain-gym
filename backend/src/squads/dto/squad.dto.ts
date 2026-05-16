export class SquadDto {
  id: string;
  name: string;
  slug: string;
  certificationId: string;
  targetExamDate?: Date;
  memberCount: number;
  createdAt: Date;

  constructor(data: {
    id: string;
    name: string;
    slug: string;
    certificationId: string;
    targetExamDate?: Date;
    memberCount: number;
    createdAt: Date;
  }) {
    Object.assign(this, data);
  }
}
