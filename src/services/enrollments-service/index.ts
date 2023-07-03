import { Address, Enrollment } from '@prisma/client';
import { Response } from 'express';
import httpStatus from 'http-status';
import { request } from '@/utils/request';
import { invalidDataError, notFoundError, requestError } from '@/errors';
import addressRepository, { CreateAddressParams } from '@/repositories/address-repository';
import enrollmentRepository, { CreateEnrollmentParams } from '@/repositories/enrollment-repository';
import { exclude } from '@/utils/prisma-utils';

// TODO - Receber o CEP por parâmetro nesta função.
async function getAddressFromCEP(cep: string) {
  const result = await request.get(`${process.env.VIA_CEP_API}/${cep}/json/`);

  if (result.status == 400) {
    throw requestError(result.status, result.statusText);
  }

  if (!result.data) {
    throw notFoundError();
  } else if ('erro' in result.data) {
    throw notFoundError();
  }

  const { logradouro, complemento, bairro, localidade, uf } = result.data;
  const formattedAddress = {
    logradouro,
    complemento,
    bairro,
    localidade,
    uf,
  };

  return formattedAddress;
}

async function getOneWithAddressByUserId(userId: number): Promise<GetOneWithAddressByUserIdResult> {
  const enrollmentWithAddress = await enrollmentRepository.findWithAddressByUserId(userId);

  if (!enrollmentWithAddress) throw notFoundError();

  const [firstAddress] = enrollmentWithAddress.Address;
  const address = getFirstAddress(firstAddress);

  return {
    ...exclude(enrollmentWithAddress, 'userId', 'createdAt', 'updatedAt', 'Address'),
    ...(!!address && { address }),
  };
}

type GetOneWithAddressByUserIdResult = Omit<Enrollment, 'userId' | 'createdAt' | 'updatedAt'>;

function getFirstAddress(firstAddress: Address): GetAddressResult {
  if (!firstAddress) return null;

  return exclude(firstAddress, 'createdAt', 'updatedAt', 'enrollmentId');
}

type GetAddressResult = Omit<Address, 'createdAt' | 'updatedAt' | 'enrollmentId'>;

async function createOrUpdateEnrollmentWithAddress(params: CreateOrUpdateEnrollmentWithAddress, res: Response) {
  const enrollment = exclude(params, 'address');
  const address = getAddressForUpsert(params.address);

  try {
    const response = await request.get(`${process.env.VIA_CEP_API}/${address.cep}/json/`);

    if (response.status == 400) {
      throw requestError(response.status, response.statusText);
    }

    if (!response) {
      throw notFoundError();
    } else if ('erro' in response) {
      throw notFoundError();
    }

    const newEnrollment = await enrollmentRepository.upsert(params.userId, enrollment, exclude(enrollment, 'userId'));

    await addressRepository.upsert(newEnrollment.id, address, address);

    return res.status(httpStatus.CREATED);
  } catch (error) {
    console.error(error);
    return res.status(httpStatus.BAD_REQUEST).send(invalidDataError);
  }
}

function getAddressForUpsert(address: CreateAddressParams) {
  return {
    ...address,
    ...(address?.addressDetail && { addressDetail: address.addressDetail }),
  };
}

export type CreateOrUpdateEnrollmentWithAddress = CreateEnrollmentParams & {
  address: CreateAddressParams;
};

const enrollmentsService = {
  getOneWithAddressByUserId,
  createOrUpdateEnrollmentWithAddress,
  getAddressFromCEP,
};

export default enrollmentsService;
