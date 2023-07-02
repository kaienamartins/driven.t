import { Response } from 'express';
import httpStatus from 'http-status';
import { AuthenticatedRequest } from '@/middlewares';
import enrollmentsService from '@/services/enrollments-service';

export async function getEnrollmentByUser(req: AuthenticatedRequest, res: Response) {
  const { userId } = req;

  try {
    const enrollmentWithAddress = await enrollmentsService.getOneWithAddressByUserId(userId);

    return res.status(httpStatus.OK).send(enrollmentWithAddress);
  } catch (error) {
    return res.sendStatus(httpStatus.NO_CONTENT);
  }
}

export async function postCreateOrUpdateEnrollment(req: AuthenticatedRequest, res: Response) {
  try {
    await enrollmentsService.createOrUpdateEnrollmentWithAddress({
      ...req.body,
      userId: req.userId,
    });

    return res.sendStatus(httpStatus.OK);
  } catch (error) {
    return res.sendStatus(httpStatus.BAD_REQUEST);
  }
}

// TODO - Receber o CEP do usuário por query params.

export async function getAddressFromCEP(req: AuthenticatedRequest, res: Response) {
  const { cep } = req.query;
  if (!cep || typeof cep !== 'string' || cep.trim() === '') {
    return res.sendStatus(httpStatus.BAD_REQUEST);
  }

  try {
    const address = await enrollmentsService.getAddressFromCEP(cep);

    if (!address) {
      return res.sendStatus(httpStatus.NO_CONTENT);
    }

    const formattedAddress = {
      logradouro: address.logradouro,
      complemento: address.complemento,
      bairro: address.bairro,
      cidade: address.localidade,
      uf: address.uf,
    };

    res.status(httpStatus.OK).json(formattedAddress);
  } catch (error) {
    if (error.name === 'NotFoundError') {
      return res.send(httpStatus.NO_CONTENT);
    }
  }
}
